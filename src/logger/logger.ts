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
import { getSdkLogContextValue } from './logger.context';

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
      sdk_log: true,
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
   * Logs a pre-formatted message string to the console.
   * In production mode, wraps the message with JSON formatting and event context tags.
   * In local development mode, logs the message directly without JSON wrapping.
   * This is useful when you need to log already-stringified content.
   *
   * @param message - The pre-formatted message string to log
   * @param level - Log level (info, warn, error)
   * @param sdkLog - Flag indicating if the log originated from the SDK
   */
  logFn(
    message: string,
    level: LogLevel,
    sdkLog: boolean = this.getSdkLogFlag()
  ): void {
    if (this.options?.isLocalDevelopment) {
      this.originalConsole[level](message);
      return;
    }

    const logObject = {
      message,
      ...this.tags,
      sdk_log: sdkLog,
    };
    this.originalConsole[level](JSON.stringify(logObject));
  }

  /**
   * Stringifies and logs arguments to the appropriate destination.
   * On main thread, converts arguments to strings and calls logFn.
   * In worker threads, forwards stringified arguments to the main thread for processing.
   * All arguments are converted to strings using util.inspect and joined with spaces.
   *
   * @param args - Values to log (will be stringified and truncated if needed)
   * @param level - Log level (info, warn, error)
   */
  private stringifyAndLog(args: unknown[], level: LogLevel): void {
    let stringifiedArgs = args.map((arg) => this.valueToString(arg)).join(' ');
    stringifiedArgs = this.truncateMessage(stringifiedArgs);

    const sdkLogFlag = this.getSdkLogFlag();

    if (isMainThread) {
      this.logFn(stringifiedArgs, level, sdkLogFlag);
    } else {
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageLog,
        payload: { stringifiedArgs, level, sdk_log: sdkLogFlag },
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

  private getSdkLogFlag(): boolean {
    return getSdkLogContextValue(this.tags.sdk_log);
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
