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
}

/**
 * InitialDomainMapping is an interface that defines the structure of the initial domain mapping.
 */
export interface InitialDomainMapping {
  starting_recipe_blueprint?: object;
  additional_mappings?: object;
}

/**
 * SyncMode is an enum that defines the different modes of sync that can be used by the external extractor.
 * It can be either INITIAL, INCREMENTAL or LOADING. INITIAL mode is used for
 * the first/initial import, while INCREMENTAL mode is used for doing syncs. LOADING mode is used for
 * loading data from DevRev to the external system.
 */
export enum SyncMode {
  INITIAL = 'INITIAL',
  INCREMENTAL = 'INCREMENTAL',
  LOADING = 'LOADING',
}
