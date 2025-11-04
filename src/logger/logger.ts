import { Console } from 'node:console';
import crypto from 'node:crypto';
import { inspect } from 'node:util';

import { AxiosError, isAxiosError, RawAxiosResponseHeaders } from 'axios';
import { WorkerAdapterOptions } from '../types/workers';
import {
  AxiosErrorResponse,
  LoggerFactoryInterface,
  LoggerTags,
  LogLevel,
  PrintableArray,
  PrintableState,
} from './logger.interfaces';

/**
 * Runtime-generated token for internal SDK logger access.
 * Stored in module closure - not accessible from outside.
 * @internal
 */
const INTERNAL_LOGGER_TOKEN = crypto.getRandomValues(new Uint8Array(32));

/**
 * Verify that a token matches the internal token.
 * @internal
 */
function verifyToken(token: Uint8Array): boolean {
  if (token.length !== INTERNAL_LOGGER_TOKEN.length) {
    return false;
  }
  // Constant-time comparison to prevent timing attacks
  let result = 0;
  for (let i = 0; i < token.length; i++) {
    result |= token[i] ^ INTERNAL_LOGGER_TOKEN[i];
  }
  return result === 0;
}

/**
 * Abstract base logger class. Not exported - use factory functions instead.
 * @internal
 */
abstract class BaseLogger extends Console {
  protected originalConsole: Console;
  protected options?: WorkerAdapterOptions;
  protected tags: LoggerTags;

  protected constructor({ event, options }: LoggerFactoryInterface) {
    super(process.stdout, process.stderr);
    this.originalConsole = console;
    this.options = options;
    this.tags = {
      ...event.payload.event_context,
      dev_oid: event.payload.event_context.dev_oid,
      sdk_log: false, // Set by subclass
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

  protected logFn(args: unknown[], level: LogLevel): void {
    if (this.options?.isLocalDevelopment) {
      this.originalConsole[level](...args);
    } else {
      const message = args.map((arg) => this.valueToString(arg)).join(' ');

      const logObject = {
        message,
        ...this.tags,
      };

      this.originalConsole[level](JSON.stringify(logObject));
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
 * Verified SDK logger - marked with sdk_log: true
 * Only accessible through getInternalLogger() factory with valid token.
 * @internal
 */
class VerifiedLogger extends BaseLogger {
  constructor({ event, options }: LoggerFactoryInterface, token: Uint8Array) {
    if (!verifyToken(token)) {
      throw new Error('Unauthorized: Invalid token for VerifiedLogger');
    }
    super({ event, options });
    this.tags.sdk_log = true;
    Object.freeze(this.tags); // Immutable after construction
  }
}

/**
 * User logger - marked with sdk_log: false
 * Exported for public use via createUserLogger() factory.
 */
export class UserLogger extends BaseLogger {
  constructor({ event, options }: LoggerFactoryInterface) {
    super({ event, options });
    // sdk_log already false from BaseLogger
    Object.freeze(this.tags); // Immutable after construction
  }
}

/**
 * Factory function to create a verified SDK logger.
 * @internal
 */
export function getInternalLogger(
  event: LoggerFactoryInterface['event'],
  options?: LoggerFactoryInterface['options']
): BaseLogger {
  return new VerifiedLogger({ event, options }, INTERNAL_LOGGER_TOKEN);
}

/**
 * Factory function to create a user logger (unverified).
 * @internal
 */
export function createUserLogger(
  event: LoggerFactoryInterface['event'],
  options?: LoggerFactoryInterface['options']
): UserLogger {
  return new UserLogger({ event, options });
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
