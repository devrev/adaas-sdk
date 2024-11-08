import { Artifact } from '../uploader/uploader.interfaces';

/**
 * ErrorLevel is an enum that represents the level of an error.
 * @deprecated
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
 * @deprecated
 */
export interface LogRecord {
  level: ErrorLevel;
  message: string;
}

/**
 * AdapterUpdateParams is an interface that defines the structure of the parameters that can be passed to the update adapter.
 * @deprecated
 */
export interface AdapterUpdateParams {
  artifact?: Artifact;
  extractor_state?: object;
}

/**
 * InitialDomainMapping is an interface that defines the structure of the initial domain mapping.
 */
export interface InitialDomainMapping {
  starting_recipe_blueprint?: object;
  additional_mappings?: object;
}
