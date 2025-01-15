import log from 'lambda-log';
import { Console } from 'node:console';

import {
  LoggerFactoryInterface,
  LogLevel,
  PrintableArray,
  PrintableState,
} from './logger.interfaces';
import { isMainThread, parentPort } from 'node:worker_threads';
import { WorkerAdapterOptions, WorkerMessageSubject } from '../types/workers';
import { AxiosError } from 'axios';
import { getCircularReplacer } from '../common/helpers';

export class Logger extends Console {
  private options?: WorkerAdapterOptions;

  constructor({ event, options }: LoggerFactoryInterface) {
    super(process.stdout, process.stderr);
    this.options = options;

    log.options.levelKey = null;
    log.options.tagsKey = null;
    log.options.messageKey = 'message';
    log.options.meta = {
      ...event.payload.event_context,
      dev_oid: event.payload.event_context.dev_org,
    };
  }

  logFn(args: unknown[], level: LogLevel): void {
    if (isMainThread) {
      if (this.options?.isLocalDevelopment) {
        console[level](...args);
      } else {
        log.log(level, JSON.stringify(args));
      }
    } else {
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageLog,
        payload: {
          args: JSON.parse(JSON.stringify(args, getCircularReplacer())),
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

export function formatAxiosError(error: AxiosError): object {
  if (error.response) {
    return {
      status: error.response.status,
      data: error.response.data,
      method: error.config?.method,
      baseURL: error.config?.baseURL,
      url: error.config?.url,
      payload: error.config?.data,
    };
  }

  return error;
}
