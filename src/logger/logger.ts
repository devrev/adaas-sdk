import { Console } from 'node:console';
import { inspect, InspectOptions } from 'node:util';
import { isMainThread, parentPort } from 'node:worker_threads';

import { AxiosError, isAxiosError, RawAxiosResponseHeaders } from 'axios';

import { LIBRARY_VERSION } from '../common/constants';
import { WorkerAdapterOptions, WorkerMessageSubject } from '../types/workers';

import {
  AxiosErrorResponse,
  LoggerFactoryInterface,
  LoggerTags,
  LogLevel,
  PrintableArray,
  PrintableState,
} from './logger.interfaces';

// ── Log formatting ──

export const MAX_LOG_STRING_LENGTH = 10000;
const MAX_LOG_DEPTH = 10;
const MAX_LOG_ARRAY_LENGTH = 100;

export const INSPECT_OPTIONS: InspectOptions = {
  compact: false,
  breakLength: Infinity,
  depth: MAX_LOG_DEPTH,
  maxArrayLength: MAX_LOG_ARRAY_LENGTH,
  maxStringLength: MAX_LOG_STRING_LENGTH,
};

export function truncateMessage(message: string): string {
  if (message.length > MAX_LOG_STRING_LENGTH) {
    return `${message.substring(0, MAX_LOG_STRING_LENGTH)}... ${
      message.length - MAX_LOG_STRING_LENGTH
    } more characters`;
  }
  return message;
}

/**
 * Console replacement that tags every log line with the event context. Worker
 * threads forward log lines to the main thread, because the snap-in platform
 * only captures logs written through the main thread's console.
 */
export class Logger extends Console {
  private originalConsole: Console;
  private options?: WorkerAdapterOptions;
  private tags: LoggerTags;

  constructor({ event, options }: LoggerFactoryInterface) {
    super(process.stdout, process.stderr);
    this.originalConsole = console;
    this.options = options;
    this.tags = {
      ...event.payload.event_context,
      sdk_version: LIBRARY_VERSION,
    };
  }

  private valueToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return inspect(value, INSPECT_OPTIONS);
  }

  /** In production wraps the message in JSON with event context tags; in local development logs as-is. */
  logFn(message: string, level: LogLevel): void {
    if (this.options?.isLocalDevelopment) {
      this.originalConsole[level](message);
      return;
    }

    const logObject = {
      message,
      ...this.tags,
    };
    this.originalConsole[level](JSON.stringify(logObject));
  }

  private stringifyAndLog(args: unknown[], level: LogLevel): void {
    let stringifiedArgs = args.map((arg) => this.valueToString(arg)).join(' ');
    stringifiedArgs = truncateMessage(stringifiedArgs);

    if (isMainThread) {
      this.logFn(stringifiedArgs, level);
    } else {
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageLog,
        payload: { stringifiedArgs, level },
      });
    }
  }

  override log(...args: unknown[]): void {
    this.stringifyAndLog(args, LogLevel.INFO);
  }

  override info(...args: unknown[]): void {
    this.stringifyAndLog(args, LogLevel.INFO);
  }

  override warn(...args: unknown[]): void {
    this.stringifyAndLog(args, LogLevel.WARN);
  }

  override error(...args: unknown[]): void {
    this.stringifyAndLog(args, LogLevel.ERROR);
  }
}

/** Summarizes arrays as `{ length, firstItem, lastItem }` instead of listing all elements. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPrintableState(state: Record<string, any>): PrintableState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processValue(value: any): any {
    if (Array.isArray(value)) {
      return {
        type: 'array',
        length: value.length,
        firstItem: value.length > 0 ? value[0] : undefined,
        lastItem: value.length > 1 ? value[value.length - 1] : undefined,
      } as PrintableArray;
    } else if (typeof value === 'object' && value !== null) {
      const processedObject: PrintableState = {};
      for (const key in value) {
        processedObject[key] = processValue(value[key]);
      }
      return processedObject;
    }
    return value;
  }

  return processValue(state) as PrintableState;
}

/** Serializes any error into a loggable string; Axios errors get HTTP details. */
export function serializeError(error: unknown): string {
  if (isAxiosError(error)) {
    return JSON.stringify(serializeAxiosError(error));
  }
  if (error instanceof Error) {
    // Include non-default error name (e.g. TypeError) for easier debugging
    return error.name !== 'Error'
      ? `${error.name}: ${error.message}`
      : error.message;
  }
  if (typeof error === 'string') {
    return error;
  }

  // JSON.stringify returns '{}' for objects with only non-enumerable properties
  // Fall back to extracting own property names or String() coercion.
  const stringified = JSON.stringify(error);
  if (!stringified || stringified === '{}') {
    if (error !== null && typeof error === 'object') {
      const props: Record<string, unknown> = {};
      for (const key of Object.getOwnPropertyNames(error)) {
        props[key] = (error as Record<string, unknown>)[key];
      }
      const extracted = JSON.stringify(props);
      if (extracted && extracted !== '{}') {
        return extracted;
      }
    }
    try {
      return String(error);
    } catch {
      return '[Unserializable error]';
    }
  }
  return stringified;
}

export function serializeAxiosError(error: AxiosError): AxiosErrorResponse {
  const serializedAxiosError: AxiosErrorResponse = {
    config: {
      method: error.config?.method,
      params: error.config?.params,
      url: error.config?.url,
    },
    isAxiosError: true,
    isCorsOrNoNetworkError: !error.response,
  };

  if (error.response) {
    serializedAxiosError.response = {
      data: error.response.data,
      headers: error.response.headers as RawAxiosResponseHeaders,
      status: error.response.status,
      statusText: error.response.statusText,
    };
  } else {
    serializedAxiosError.code = error.code;
    serializedAxiosError.message = error.message;
  }

  return serializedAxiosError;
}
