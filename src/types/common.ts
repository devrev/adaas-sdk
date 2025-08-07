import { Artifact } from '../uploader/uploader.interfaces';

/**
 * ErrorLevel is an enum that represents the level of an error.
 * @deprecated This enum is deprecated. Use standard logging levels or create domain-specific error level enums instead.
 */
export enum ErrorLevel {
  Warning = 'WARNING',
  Error = 'ERROR',
  Info = 'INFO',
}

/**
 * ErrorRecord is an interface that defines the structure of an error record.
 */
export interface ErrorRecord {
  message: string;
}

/**
 * LogRecord is an interface that defines the structure of a log record.
 * @deprecated This interface is deprecated. Use structured logging libraries or create domain-specific log record interfaces instead.
 */
export interface LogRecord {
  level: ErrorLevel;
  message: string;
}

/**
 * AdapterUpdateParams is an interface that defines the structure of the parameters that can be passed to the update adapter.
 * @deprecated This interface is deprecated. Use the new WorkerAdapter pattern instead, which handles updates through the worker-based architecture.
 */
export interface AdapterUpdateParams {
  artifact?: Artifact;
}

/**
 * InitialDomainMapping is an interface that defines the structure of the initial domain mapping.
 */
export interface InitialDomainMapping {
  starting_recipe_blueprint?: object;
  additional_mappings?: object;
}
