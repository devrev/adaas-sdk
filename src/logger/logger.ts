import { Console } from 'node:console';
import { inspect } from 'node:util';
import { isMainThread, parentPort } from 'node:worker_threads';

import { AxiosError, isAxiosError, RawAxiosResponseHeaders } from 'axios';
import {
  LIBRARY_VERSION,
  MAX_LOG_ARRAY_LENGTH,
  MAX_LOG_DEPTH,
  MAX_LOG_STRING_LENGTH,
} from '../common/constants';
import { WorkerAdapterOptions, WorkerMessageSubject } from '../types/workers';
import {
  AxiosErrorResponse,
  LoggerFactoryInterface,
  LoggerTags,
  LogLevel,
  PrintableArray,
  PrintableState,
} from './logger.interfaces';

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
    // If the value is a string, return the first MAX_LOG_STRING_LENGTH characters
    if (typeof value === 'string') {
      if (value.length > MAX_LOG_STRING_LENGTH) {
        return `${value.substring(0, MAX_LOG_STRING_LENGTH)}... ${
          value.length - MAX_LOG_STRING_LENGTH
        } more characters`;
      } else {
        return value;
      }
    }

    // Use inspect for everything else
    return inspect(value, {
      compact: true,
      breakLength: 80,
      depth: MAX_LOG_DEPTH,
      maxArrayLength: MAX_LOG_ARRAY_LENGTH,
      maxStringLength: MAX_LOG_STRING_LENGTH,
    });
  }

  logFn(args: unknown[], level: LogLevel, skipSanitization = false): void {
    const message = skipSanitization
      ? (args as string[]).join(' ')
      : args.map((arg) => this.valueToString(arg)).join(' ');

    // If local development, log the message to the console and don't add the tags
    if (this.options?.isLocalDevelopment) {
      this.originalConsole[level](message);
      return;
    }

    if (isMainThread) {
      // If main thread, log the message to the console and add the tags
      const logObject = {
        message,
        ...this.tags,
      };
      this.originalConsole[level](JSON.stringify(logObject));
    } else {
      // If worker thread, send the message to the main thread to log it
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

// Helper function to process each value in the state
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPrintableState(state: Record<string, any>): PrintableState {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function processValue(value: any): any {
    if (Array.isArray(value)) {
      // If the value is an array, summarize it
      return {
        type: 'array',
        length: value.length,
        firstItem: value.length > 0 ? value[0] : undefined,
        lastItem: value.length > 1 ? value[value.length - 1] : undefined,
      } as PrintableArray;
    } else if (typeof value === 'object' && value !== null) {
      // If the value is an object, recursively process its properties
      const processedObject: PrintableState = {};
      for (const key in value) {
        processedObject[key] = processValue(value[key]);
      }
      return processedObject;
    }
    // For primitive types, return the value as is
    return value;
  }

  // Process the state object directly since it's guaranteed to be an object
  return processValue(state) as PrintableState;
}
/**
 * @deprecated
 */
export function formatAxiosError(error: AxiosError): object {
  return serializeAxiosError(error);
}

export const serializeError = (error: unknown) => {
  if (isAxiosError(error)) {
    return serializeAxiosError(error);
  }
  return error;
};

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
