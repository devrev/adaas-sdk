export interface ErrorRecord {
  message: string;
}

export interface InitialDomainMapping {
  starting_recipe_blueprint?: object;
  additional_mappings?: object;
}

/** INITIAL = first import, INCREMENTAL = subsequent syncs, LOADING = DevRev -> external system. */
export enum SyncMode {
  INITIAL = 'INITIAL',
  INCREMENTAL = 'INCREMENTAL',
  LOADING = 'LOADING',
}
