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
