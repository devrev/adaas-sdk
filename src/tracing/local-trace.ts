import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import * as path from 'node:path';
import { isMainThread, threadId } from 'node:worker_threads';

import type {
  Attributes,
  Context,
  Span,
  SpanContext,
  Tracer,
} from '@opentelemetry/api';
import type { ReadableSpan } from '@opentelemetry/sdk-trace-base';

import { runWithUserLogContext } from '../logger/logger.context';
import type { SerializedSpanContext } from '../types/common';

const SESSION_DIR = '.adaas-traces';

export interface TraceSource {
  file: string;
  symbol: string;
  line?: number;
}

export interface TraceSpanOptions {
  attributes?: Attributes;
  source?: TraceSource;
  parentSpanContext?: SerializedSpanContext;
}

export interface LocalTraceSession {
  enabled: boolean;
  outputPath?: string;
  withSpan<T>(
    name: string,
    options: TraceSpanOptions,
    fn: (span: Span | undefined) => Promise<T> | T
  ): Promise<T>;
  markError(error: unknown, span?: Span): void;
  getCurrentSpanContext(): SerializedSpanContext | undefined;
  shutdown(): Promise<void>;
}

export interface LocalTraceSessionConfig {
  enabled: boolean;
  outputPath?: string;
}

export interface SerializedTraceSpanContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

interface SpanFileRecord {
  type: 'span';
  session_id: string;
  thread: 'main' | 'worker';
  thread_id: number;
  pid: number;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  name: string;
  kind: 'internal' | 'server' | 'client' | 'producer' | 'consumer';
  status: {
    code: 'UNSET' | 'OK' | 'ERROR';
    message?: string;
  };
  start_time: string;
  end_time: string;
  duration_ms: number;
  source?: TraceSource;
  attributes?: Record<string, unknown>;
  events?: Array<{
    name: string;
    timestamp: string;
    attributes?: Record<string, unknown>;
  }>;
}

interface ErrorFileRecord {
  type: 'error';
  session_id: string;
  thread: 'main' | 'worker';
  thread_id: number;
  pid: number;
  trace_id: string;
  span_id: string;
  parent_span_id?: string;
  span_name: string;
  timestamp: string;
  message: string;
  name?: string;
  stack?: string;
  source?: TraceSource;
  attributes?: Record<string, unknown>;
}

interface SessionFileRecord {
  type: 'session';
  session_id: string;
  thread: 'main' | 'worker';
  thread_id: number;
  pid: number;
  started_at: string;
  output_path: string;
}

interface SessionEndFileRecord {
  type: 'session_end';
  session_id: string;
  thread: 'main' | 'worker';
  thread_id: number;
  pid: number;
  finished_at: string;
  spans: number;
  errors: number;
}

type TraceFileRecord =
  | ErrorFileRecord
  | SessionEndFileRecord
  | SessionFileRecord
  | SpanFileRecord;

interface TraceApi {
  context: typeof import('@opentelemetry/api').context;
  trace: typeof import('@opentelemetry/api').trace;
  ROOT_CONTEXT: Context;
  SpanStatusCode: typeof import('@opentelemetry/api').SpanStatusCode;
}

let activeSession: TraceSessionImpl | undefined;
let contextManagerInstalled = false;

function nowIsoFromHrTime(hrTime: [number, number]): string {
  const [seconds, nanoseconds] = hrTime;
  return new Date(seconds * 1000 + nanoseconds / 1_000_000).toISOString();
}

function durationMs(
  startTime: [number, number],
  endTime: [number, number]
): number {
  return (
    (endTime[0] - startTime[0]) * 1000 + (endTime[1] - startTime[1]) / 1_000_000
  );
}

function mapSpanStatusCode(code: number): 'UNSET' | 'OK' | 'ERROR' {
  switch (code) {
    case 1:
      return 'OK';
    case 2:
      return 'ERROR';
    default:
      return 'UNSET';
  }
}

function mapSpanKind(
  kind: number
): 'internal' | 'server' | 'client' | 'producer' | 'consumer' {
  switch (kind) {
    case 1:
      return 'server';
    case 2:
      return 'client';
    case 3:
      return 'producer';
    case 4:
      return 'consumer';
    default:
      return 'internal';
  }
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  try {
    return new Error(JSON.stringify(error));
  } catch {
    return new Error(String(error));
  }
}

function serializeAttributes(attributes?: Attributes): Attributes | undefined {
  if (!attributes) {
    return undefined;
  }

  const result: Attributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (value !== undefined) {
      result[key] = value as never;
    }
  }

  return Object.keys(result).length ? result : undefined;
}

function extractSource(attributes?: Attributes): {
  source?: TraceSource;
  attributes?: Attributes;
} {
  if (!attributes) {
    return {};
  }

  const nextAttributes = { ...attributes } as Record<string, unknown>;
  const file = nextAttributes['trace.source.file'];
  const symbol = nextAttributes['trace.source.symbol'];
  const line = nextAttributes['trace.source.line'];

  delete nextAttributes['trace.source.file'];
  delete nextAttributes['trace.source.symbol'];
  delete nextAttributes['trace.source.line'];

  const source: TraceSource | undefined =
    typeof file === 'string' && typeof symbol === 'string'
      ? {
          file,
          symbol,
          ...(typeof line === 'number' ? { line } : {}),
        }
      : undefined;

  return {
    source,
    attributes: Object.keys(nextAttributes).length
      ? (nextAttributes as Attributes)
      : undefined,
  };
}

function serializeSpanContext(
  spanContext: SpanContext | undefined
): SerializedTraceSpanContext | undefined {
  if (!spanContext) {
    return undefined;
  }

  return {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
  };
}

function deserializeSpanContext(
  spanContext: SerializedSpanContext | undefined,
  api: TraceApi
): Context {
  if (!spanContext) {
    return api.ROOT_CONTEXT;
  }

  return api.trace.setSpanContext(api.ROOT_CONTEXT, {
    traceId: spanContext.traceId,
    spanId: spanContext.spanId,
    traceFlags: spanContext.traceFlags,
    isRemote: true,
  });
}

function getThreadName(): 'main' | 'worker' {
  return isMainThread ? 'main' : 'worker';
}

function resolveDefaultTraceOutputPath(): string {
  const outputPathEnv = process.env.ADAAS_TRACE_OUTPUT_FILE;
  if (outputPathEnv) {
    return path.resolve(outputPathEnv);
  }

  const outputDir = process.env.ADAAS_TRACE_OUTPUT_DIR
    ? path.resolve(process.env.ADAAS_TRACE_OUTPUT_DIR)
    : path.join(process.cwd(), SESSION_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = `${process.pid}-${threadId}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  return path.join(outputDir, `adaas-trace-${timestamp}-${suffix}.ndjson`);
}

function ensureOutputDirectory(outputPath: string): void {
  const outputDir = path.dirname(outputPath);
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }
}

class JsonlTraceExporter {
  private outputPath: string;
  private sessionId: string;
  private thread: 'main' | 'worker';
  private spansWritten = 0;
  private errorsWritten = 0;
  private closed = false;

  constructor(outputPath: string, sessionId: string) {
    this.outputPath = outputPath;
    this.sessionId = sessionId;
    this.thread = getThreadName();
    ensureOutputDirectory(outputPath);

    this.writeRecord({
      type: 'session',
      session_id: this.sessionId,
      thread: this.thread,
      thread_id: threadId,
      pid: process.pid,
      started_at: new Date().toISOString(),
      output_path: this.outputPath,
    });
  }

  private writeRecord(record: TraceFileRecord): void {
    appendFileSync(this.outputPath, `${JSON.stringify(record)}\n`);
  }

  writeError(record: ErrorFileRecord): void {
    this.writeRecord(record);
    this.errorsWritten += 1;
  }

  private writeSpan(span: ReadableSpan): void {
    const attributes = serializeAttributes(span.attributes);
    const { source, attributes: cleanedAttributes } = extractSource(attributes);
    const events = span.events?.length
      ? (
          span.events as Array<{
            name: string;
            time: [number, number];
            attributes?: Record<string, unknown>;
          }>
        ).map((event) => ({
          name: event.name,
          timestamp: nowIsoFromHrTime(event.time),
          attributes: serializeAttributes(
            event.attributes as Attributes | undefined
          ),
        }))
      : undefined;

    const spanRecord: SpanFileRecord = {
      type: 'span',
      session_id: this.sessionId,
      thread: this.thread,
      thread_id: threadId,
      pid: process.pid,
      trace_id: span.spanContext().traceId,
      span_id: span.spanContext().spanId,
      ...(span.parentSpanId ? { parent_span_id: span.parentSpanId } : {}),
      name: span.name,
      kind: mapSpanKind(span.kind),
      status: {
        code: mapSpanStatusCode(span.status.code),
        ...(span.status.message ? { message: span.status.message } : {}),
      },
      start_time: nowIsoFromHrTime(span.startTime),
      end_time: nowIsoFromHrTime(span.endTime),
      duration_ms: durationMs(span.startTime, span.endTime),
      ...(source ? { source } : {}),
      ...(cleanedAttributes ? { attributes: cleanedAttributes } : {}),
      ...(events ? { events } : {}),
    };

    this.writeRecord(spanRecord);
    this.spansWritten += 1;
  }

  export(
    spans: ReadableSpan[],
    resultCallback: (result: { code: number }) => void
  ): void {
    try {
      for (const span of spans) {
        this.writeSpan(span);
      }
      resultCallback({ code: 0 });
    } catch (error) {
      resultCallback({ code: 1 });
      process.stderr.write(
        `[adaas-trace] Failed to write trace records to ${
          this.outputPath
        }: ${String(error)}\n`
      );
    }
  }

  async forceFlush(): Promise<void> {
    return Promise.resolve();
  }

  async shutdown(): Promise<void> {
    if (this.closed) {
      return Promise.resolve();
    }
    this.closed = true;

    this.writeRecord({
      type: 'session_end',
      session_id: this.sessionId,
      thread: this.thread,
      thread_id: threadId,
      pid: process.pid,
      finished_at: new Date().toISOString(),
      spans: this.spansWritten,
      errors: this.errorsWritten,
    });

    return Promise.resolve();
  }
}

class TraceSessionImpl implements LocalTraceSession {
  enabled = false;
  outputPath?: string;
  private tracer: Tracer | undefined;
  private provider:
    | {
        shutdown: () => Promise<void>;
      }
    | undefined;
  private api: TraceApi | undefined;
  private sessionId = '';
  private exporter: JsonlTraceExporter | undefined;

  private constructor() {}

  static async create(
    config: LocalTraceSessionConfig
  ): Promise<TraceSessionImpl> {
    const session = new TraceSessionImpl();
    session.enabled = config.enabled;
    session.outputPath = config.outputPath;

    if (!config.enabled) {
      return session;
    }

    const [api, contextHooks, sdkTraceBase, sdkTraceNode] = await Promise.all([
      import('@opentelemetry/api'),
      import('@opentelemetry/context-async-hooks'),
      import('@opentelemetry/sdk-trace-base'),
      import('@opentelemetry/sdk-trace-node'),
    ]);

    if (!contextManagerInstalled) {
      api.context.setGlobalContextManager(
        new contextHooks.AsyncLocalStorageContextManager()
      );
      contextManagerInstalled = true;
    }

    session.api = api;
    session.sessionId = cryptoRandomId();
    session.outputPath = path.resolve(
      config.outputPath ?? resolveDefaultTraceOutputPath()
    );
    session.exporter = new JsonlTraceExporter(
      session.outputPath,
      session.sessionId
    );

    const provider = new sdkTraceNode.NodeTracerProvider();
    provider.addSpanProcessor(
      new sdkTraceBase.SimpleSpanProcessor(session.exporter)
    );
    session.provider = provider;
    session.tracer = provider.getTracer('adaas-sdk');

    activeSession = session;

    return session;
  }

  async withSpan<T>(
    name: string,
    options: TraceSpanOptions,
    fn: (span: Span | undefined) => Promise<T> | T
  ): Promise<T> {
    if (!this.enabled || !this.api || !this.tracer) {
      return fn(undefined);
    }

    const attributes = serializeAttributes(options.attributes) ?? {};
    const sourceAttributes = options.source
      ? {
          'trace.source.file': options.source.file,
          'trace.source.symbol': options.source.symbol,
          ...(options.source.line !== undefined
            ? { 'trace.source.line': options.source.line }
            : {}),
        }
      : {};

    const parentContext = options.parentSpanContext
      ? deserializeSpanContext(options.parentSpanContext, this.api)
      : this.api.context.active();

    const finalAttributes = {
      ...attributes,
      ...sourceAttributes,
      'trace.thread': getThreadName(),
    };

    return this.tracer.startActiveSpan(
      name,
      {
        attributes: finalAttributes,
      },
      parentContext,
      async (span: Span) => {
        try {
          return await fn(span);
        } catch (error) {
          this.markError(error, span);
          throw error;
        } finally {
          span.end();
        }
      }
    );
  }

  markError(error: unknown, span?: Span): void {
    if (!this.enabled || !this.api) {
      return;
    }

    const activeSpan =
      span ?? this.api.trace.getSpan(this.api.context.active());
    if (!activeSpan) {
      return;
    }

    const normalizedError = normalizeError(error);
    activeSpan.recordException(normalizedError);
    activeSpan.setStatus({
      code: this.api.SpanStatusCode.ERROR,
      message: normalizedError.message,
    });

    if (this.exporter) {
      this.exporter.writeError({
        type: 'error',
        session_id: this.sessionId,
        thread: getThreadName(),
        thread_id: threadId,
        pid: process.pid,
        trace_id: activeSpan.spanContext().traceId,
        span_id: activeSpan.spanContext().spanId,
        span_name: (activeSpan as Span & { name?: string }).name ?? 'unknown',
        timestamp: new Date().toISOString(),
        message: normalizedError.message,
        ...(normalizedError.name ? { name: normalizedError.name } : {}),
        ...(normalizedError.stack ? { stack: normalizedError.stack } : {}),
      });
    }
  }

  getCurrentSpanContext(): SerializedSpanContext | undefined {
    if (!this.enabled || !this.api) {
      return undefined;
    }

    return serializeSpanContext(
      this.api.trace.getSpan(this.api.context.active())?.spanContext()
    );
  }

  async shutdown(): Promise<void> {
    if (!this.enabled) {
      return Promise.resolve();
    }

    const shutdown = this.provider
      ? this.provider.shutdown()
      : Promise.resolve();

    return shutdown.finally(() => {
      if (activeSession === this) {
        activeSession = undefined;
      }
    });
  }
}

function cryptoRandomId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

const NOOP_SESSION: LocalTraceSession = {
  enabled: false,
  outputPath: undefined,
  async withSpan<T>(
    _name: string,
    _options: TraceSpanOptions,
    fn: (span: Span | undefined) => Promise<T> | T
  ): Promise<T> {
    return fn(undefined);
  },
  markError(): void {
    return;
  },
  getCurrentSpanContext(): SerializedSpanContext | undefined {
    return undefined;
  },
  async shutdown(): Promise<void> {
    return Promise.resolve();
  },
};

export async function createLocalTraceSession(
  config: LocalTraceSessionConfig
): Promise<LocalTraceSession> {
  if (!config.enabled) {
    return NOOP_SESSION;
  }

  return TraceSessionImpl.create(config);
}

export function getLocalTraceSession(): LocalTraceSession | undefined {
  return activeSession;
}

export function resolveTraceOutputPath(outputPath?: string): string {
  return path.resolve(outputPath ?? resolveDefaultTraceOutputPath());
}

export function spanContextToSerialized(
  spanContext: SpanContext | undefined
): SerializedTraceSpanContext | undefined {
  return serializeSpanContext(spanContext);
}

export async function withLocalTraceSpan<T>(
  name: string,
  options: TraceSpanOptions,
  fn: (span: Span | undefined) => Promise<T> | T
): Promise<T> {
  const session = getLocalTraceSession();
  if (!session) {
    return fn(undefined);
  }

  return session.withSpan(name, options, fn);
}

export async function withLocalTraceResult<T extends { error?: unknown }>(
  name: string,
  options: TraceSpanOptions,
  fn: (span: Span | undefined) => Promise<T> | T
): Promise<T> {
  return withLocalTraceSpan(name, options, async (span) => {
    try {
      const result = await fn(span);
      if (
        result &&
        typeof result === 'object' &&
        'error' in result &&
        result.error
      ) {
        markSpanError(result.error, span);
      }
      return result;
    } catch (error) {
      markSpanError(error, span);
      throw error;
    }
  });
}

export async function withUserTraceSpan<T>(
  name: string,
  options: TraceSpanOptions,
  fn: (span: Span | undefined) => Promise<T> | T
): Promise<T> {
  return withLocalTraceSpan(name, options, async (span) =>
    runWithUserLogContext(async () => fn(span))
  );
}

export function markSpanError(error: unknown, span?: Span): void {
  getLocalTraceSession()?.markError(error, span);
}
