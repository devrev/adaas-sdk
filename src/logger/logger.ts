import { Console } from 'node:console';
import { inspect } from 'node:util';

import {
  LoggerFactoryInterface,
  LogLevel,
  PrintableArray,
  PrintableState,
} from './logger.interfaces';
import { isMainThread, parentPort } from 'node:worker_threads';
import { WorkerAdapterOptions, WorkerMessageSubject } from '../types/workers';
import { AxiosError, RawAxiosResponseHeaders, isAxiosError } from 'axios';
import { getCircularReplacer } from '../common/helpers';
import { EventContext } from '../types/extraction';
import { INTERNAL_CHANNEL, verificationToken } from './private_logger';

export class Logger extends Console {
  private options?: WorkerAdapterOptions;
  private tags: EventContext & { dev_oid: string };
  private isVerifiedChannel: boolean = false; // false = unverified (default), true = verified

  constructor({ event, options }: LoggerFactoryInterface) {
    super(process.stdout, process.stderr);
    this.options = options;
    this.tags = {
      ...event.payload.event_context,
      dev_oid: event.payload.event_context.dev_oid,
    };
  }

  // Internal method to create a verified logger
  private [INTERNAL_CHANNEL](token: string): Logger {
    if (token === verificationToken) {
      const verifiedLogger = Object.create(this);
      verifiedLogger.isVerifiedChannel = true;
      // Ensure the verified logger retains the internal channel method
      verifiedLogger[INTERNAL_CHANNEL] = this[INTERNAL_CHANNEL].bind(this);
      // Override the logFn method to use the verified logger's context
      verifiedLogger.logFn = this.logFn.bind(verifiedLogger);
      // Override the logging methods to use the custom logFn
      verifiedLogger.log = (...args: unknown[]): void => {
        verifiedLogger.logFn(args, LogLevel.INFO);
      };
      verifiedLogger.info = (...args: unknown[]): void => {
        verifiedLogger.logFn(args, LogLevel.INFO);
      };
      verifiedLogger.warn = (...args: unknown[]): void => {
        verifiedLogger.logFn(args, LogLevel.WARN);
      };
      verifiedLogger.error = (...args: unknown[]): void => {
        verifiedLogger.logFn(args, LogLevel.ERROR);
      };
      return verifiedLogger;
    }
    throw new Error('Unauthorized access to internal channel');
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
    // Always add prefix based on verification status
    // false = unverified ([USER] prefix), true = verified ([SDK] prefix)
    const prefix = this.isVerifiedChannel ? '[SDK]' : '[USER]';
    const processedArgs = [prefix, ...args];

    if (isMainThread) {
      if (this.options?.isLocalDevelopment) {
        console[level](...processedArgs);
      } else {
        let message: string;
        if (processedArgs.length === 1 && typeof processedArgs[0] === 'string') {
          // Single string argument - use directly
          message = processedArgs[0];
        } else if (processedArgs.length === 1) {
          // Single non-string argument - convert to string properly
          message = this.valueToString(processedArgs[0]);
        } else {
          // Multiple arguments - create a readable format
          message = processedArgs.map((arg) => this.valueToString(arg)).join(' ');
        }

        const logObject = {
          message,
          ...this.tags,
        };

        console[level](JSON.stringify(logObject));
      }
    } else {
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageLog,
        payload: {
          args: processedArgs.map((arg) => this.valueToString(arg)),
          level,
        },
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
        if (value.hasOwnProperty(key)) {
          processedObject[key] = processValue(value[key]);
        }
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

export function serializeAxiosError(error: AxiosError) {
  const response = error.response
    ? {
        data: error.response.data,
        headers: error.response.headers as RawAxiosResponseHeaders,
        status: error.response.status,
        statusText: error.response.statusText,
      }
    : null;
  const config = {
    method: error.config?.method,
    params: error.config?.params,
    url: error.config?.url,
  };
  return {
    config,
    isAxiosError: true,
    isCorsOrNoNetworkError: !error.response,
    response,
  };
}
