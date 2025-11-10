import { AxiosError, isAxiosError, RawAxiosResponseHeaders } from 'axios';

import { Console } from 'node:console';
import { inspect } from 'node:util';
import { isMainThread, parentPort } from 'node:worker_threads';

import { LIBRARY_VERSION } from '../common/constants';
import { WorkerAdapterOptions, WorkerMessageSubject } from '../types/workers';

import { INSPECT_OPTIONS, MAX_LOG_STRING_LENGTH } from './logger.constants';
import {
  AxiosErrorResponse,
  LoggerFactoryInterface,
  LoggerTags,
  LogLevel,
  PrintableArray,
  PrintableState,
} from './logger.interfaces';

/**
 * Custom logger that extends Node.js Console with context-aware logging.
 * Handles local development, main thread, and worker thread logging differently.
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

  /**
   * Converts any value to a string using `util.inspect()` for complex types.
   *
   * @param value - The value to convert
   * @returns String representation of the value
   */
  private valueToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }
    return inspect(value, INSPECT_OPTIONS);
  }

  /**
   * Truncates a message if it exceeds the maximum allowed length.
   * Adds a suffix indicating how many characters were omitted.
   *
   * @param message - The message to truncate
   * @returns Truncated message or original if within limits
   */
  private truncateMessage(message: string): string {
    if (message.length > MAX_LOG_STRING_LENGTH) {
      return `${message.substring(0, MAX_LOG_STRING_LENGTH)}... ${
        message.length - MAX_LOG_STRING_LENGTH
      } more characters`;
    }
    return message;
  }

  /**
   * Core logging method that handles different execution contexts.
   * On main thread logs with JSON formatting and tags in production, or plain in local development.
   * In worker threads forwards messages to the main thread for processing.
   *
   * @param args - Values to log (converted to strings unless skipSanitization is true)
   * @param level - Log level (info, warn, error)
   * @param skipSanitization - Skip string conversion if args are already strings
   */
  logFn(args: unknown[], level: LogLevel, skipSanitization = false): void {
    let message = skipSanitization
      ? (args as string[]).join(' ')
      : args.map((arg) => this.valueToString(arg)).join(' ');
    message = this.truncateMessage(message);

    if (isMainThread) {
      if (this.options?.isLocalDevelopment) {
        this.originalConsole[level](message);
        return;
      } else {
        const logObject = {
          message,
          ...this.tags,
        };
        this.originalConsole[level](JSON.stringify(logObject));
      }
    } else {
      const sanitizedArgs = args.map((arg) => this.valueToString(arg));
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageLog,
        payload: { args: sanitizedArgs, level },
      });
    }
  }

  override log(...args: unknown[]): void {
    this.logFn(args, LogLevel.INFO);
  }

  override info(...args: unknown[]): void {
    this.logFn(args, LogLevel.INFO);
  }

  override warn(...args: unknown[]): void {
    this.logFn(args, LogLevel.WARN);
  }

  override error(...args: unknown[]): void {
    this.logFn(args, LogLevel.ERROR);
  }
}

/**
 * Converts a state object into a printable format where arrays are summarized.
 * Arrays show their length, first item, and last item instead of all elements.
 * Objects are recursively processed and primitives are returned as-is.
 *
 * @param state - State object to convert
 * @returns Printable representation with summarized arrays
 */
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

/**
 * Serializes an error into a structured format.
 * Automatically detects and formats Axios errors with HTTP details.
 * Returns other error types as-is.
 *
 * @param error - Error to serialize
 * @returns Serialized error or original if not an Axios error
 */
export function serializeError(error: unknown): unknown {
  if (isAxiosError(error)) {
    return serializeAxiosError(error);
  }
  return error;
}

/**
 * Serializes an Axios error into a structured format with HTTP request/response details.
 * Extracts method, URL, parameters, status code, headers, and data.
 * Includes CORS/network failure indicator when no response is available.
 *
 * @param error - Axios error to serialize
 * @returns Structured object with error details
 */
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

/**
 * Formats an Axios error to a printable format.
 *
 * @param error - Axios error to format
 * @returns Formatted error object
 * @deprecated Use {@link serializeAxiosError} instead
 */
export function formatAxiosError(error: AxiosError): object {
  return serializeAxiosError(error);
}
