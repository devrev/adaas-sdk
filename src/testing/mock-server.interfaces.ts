import { IncomingMessage, ServerResponse } from 'http';

export const DEFAULT_MOCK_SERVER_PORT = 3001;

export interface ParsedRequest extends IncomingMessage {
  /** URL path without query string */
  path: string;
  /** Parsed JSON body (if any) */
  body?: unknown;
}

export interface MockResponse extends ServerResponse {
  set(headers: Record<string, string>): MockResponse;
  status(code: number): MockResponse;
  json(data: unknown): void;
  buffer(data: Buffer): void;
  send(): void;
}

/** Simulates failures before succeeding. */
export interface RetryConfig {
  /** Failures before success (default: 4) */
  failureCount?: number;
  /** Status code during failures (default: 500) */
  errorStatus?: number;
  errorBody?: unknown;
  headers?: Record<string, string>;
  /** Delay in ms before each failure response */
  delay?: number;
}

export interface RouteConfig {
  path: string;
  method: string;
  status: number;
  body?: unknown;
  /** Raw binary body, e.g. gzipped JSONL (takes precedence over `body`) */
  bodyBuffer?: Buffer;
  headers?: Record<string, string>;
  retry?: RetryConfig;
  /** Delay in ms before sending the response */
  delay?: number;
}

export type RouteHandler = (req: ParsedRequest, res: MockResponse) => unknown;

export interface RequestInfo {
  method: string;
  url: string;
  body?: unknown;
}

export type RouteHandlers = Map<string, RouteHandler>;

/** Request counts per route. */
export type RequestCounts = Map<string, number>;
