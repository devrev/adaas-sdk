/**
 * ErrorRecord is an interface that defines the structure of an error record.
 */
export interface ErrorRecord {
  message: string;
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
