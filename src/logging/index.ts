enum LogLevel {
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  DEBUG = 'debug',
}

/**
 * Logger class to log messages based on the log level.
 * The log level can be set to one of the following:
 * - INFO
 * - WARN
 * - ERROR
 * - DEBUG
 *
 * The log tags can be set to any key-value pair.
 */
class Logger {
  private level: LogLevel;
  private logTags: Record<string, any> = {};
  private static instance: Logger;

  // Private constructor to prevent instantiation
  private constructor(level: LogLevel, logTags: Record<string, any> = {}) {
    this.level = level;
    this.logTags = logTags;
  }

  private log(level: LogLevel, message: string): void {
    if (this.level === level) {
      console.log(`[${level.toUpperCase()}]: ${message}`, this.logTags);
    }
  }

  // Singleton instance
  public static getInstance(
    level: LogLevel,
    logTags: Record<string, any> = {}
  ): Logger {
    if (!Logger.instance) {
      Logger.instance = new Logger(level, logTags);
    }
    return Logger.instance;
  }

  // Set log tags destructively.
  public setTags(tags: Record<string, any>): void {
    this.logTags = tags;
  }

  // Add log tags. If the key already exists, it will be overwritten.
  public addTags(tags: Record<string, any>): void {
    this.logTags = { ...this.logTags, ...tags };
  }

  info(message: string): void {
    this.log(LogLevel.INFO, message);
  }

  warn(message: string): void {
    this.log(LogLevel.WARN, message);
  }

  error(message: string): void {
    this.log(LogLevel.ERROR, message);
  }

  debug(message: string): void {
    this.log(LogLevel.DEBUG, message);
  }
}

export default Logger;
