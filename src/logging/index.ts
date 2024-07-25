import { AirdropEvent } from '../types';

export enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

/**
 * Logger class to log messages based on the log level.
 * The log level can be set to one of the following:
 * - INFO
 * - WARN
 * - ERROR
 *
 * The log tags can be set to any key-value pair.
 */
export class Logger {
  public static init(event: AirdropEvent) {
    const origLog = console.log;
    console.log = (message: string) => {
      origLog(`[${LogLevel.INFO.toUpperCase()}]: ${message}`, {
        ...event.payload.event_context,
      });
    };

    const origInfo = console.info;
    console.info = (message: string) => {
      origInfo(`[${LogLevel.INFO.toUpperCase()}]: ${message}`, {
        ...event.payload.event_context,
      });
    };

    const origWarn = console.warn;
    console.warn = (message: string) => {
      origWarn(`[${LogLevel.WARN.toUpperCase()}]: ${message}`, {
        ...event.payload.event_context,
      });
    };

    const origError = console.error;
    console.error = (message: string) => {
      origError(`[${LogLevel.ERROR.toUpperCase()}]: ${message}`, {
        ...event.payload.event_context,
      });
    };
  }
}
