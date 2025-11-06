import { Console } from 'node:console';
import { inspect } from 'node:util';
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

export class Logger extends Console {
  private originalConsole: Console;
  private options?: WorkerAdapterOptions;
  private tags: LoggerTags;

  constructor({ event, options }: LoggerFactoryInterface) {
    super(process.stdout, process.stderr);
    this.originalConsole = new Console(process.stdout, process.stderr);
    this.options = options;
    this.tags = {
      ...event.payload.event_context,
      dev_oid: event.payload.event_context.dev_oid,
      sdk_version: LIBRARY_VERSION,
    };
  }

  private valueToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    // Use Node.js built-in inspect for everything including errors
    return inspect(value, {
      compact: false,
      depth: 10,
      maxArrayLength: 100,
      maxStringLength: 10000,
    });
  }

  logWithTags(stringifiedArgs: string, level: LogLevel): void {
    if (this.options?.isLocalDevelopment) {
      this.originalConsole[level](stringifiedArgs);
    } else {
      const logObject = {
        message: stringifiedArgs,
        ...this.tags,
      };
      this.originalConsole[level](JSON.stringify(logObject));
    }
  }

  logFn(args: unknown[], level: LogLevel): void {
    const stringifiedArgs = args
      .map((arg) => this.valueToString(arg))
      .join(' ');

    if (isMainThread) {
      this.logWithTags(stringifiedArgs, level);
    } else {
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageLog,
        payload: { stringifiedArgs, level },
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
