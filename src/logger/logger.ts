import { Console } from 'node:console';
import { inspect } from 'node:util';

import { AxiosError, isAxiosError, RawAxiosResponseHeaders } from 'axios';
import { getLibraryVersion } from '../common/helpers';
import { WorkerAdapterOptions } from '../types/workers';
import {
  AxiosErrorResponse,
  LoggerFactoryInterface,
  LogLevel,
  LogTags,
  PrintableArray,
  PrintableState,
} from './logger.interfaces';

export class Logger extends Console {
  private originalConsole: Console;
  private options?: WorkerAdapterOptions;
  private tags: LogTags;
  private sdkVersion: string;

  constructor({ event, options }: LoggerFactoryInterface) {
    super(process.stdout, process.stderr);
    this.originalConsole = console;
    this.options = options;
    this.sdkVersion = getLibraryVersion();
    this.tags = {
      ...event.payload.event_context,
      sdk_version: this.sdkVersion,
    };
  }

  private valueToString(value: unknown): string {
    if (typeof value === 'string') {
      return value;
    }

    // Use Node.js built-in inspect for everything including errors
    return inspect(value, {
      compact: false,
      depth: Infinity,
    });
  }

  logFn(args: unknown[], level: LogLevel): void {
    if (this.options?.isLocalDevelopment) {
      this.originalConsole[level](...args);
    } else {
      const message = args.map((arg) => this.valueToString(arg)).join(' ');

      const logObject = {
        message,
        ...this.tags,
      };

      this.originalConsole[level](logObject);
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
