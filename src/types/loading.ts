import { Mappers } from '../mappers/mappers';
import { ErrorRecord } from './common';
import { AirSyncEvent } from './extraction';

/**
 * Describes a single prepared data file as listed in the loading stats manifest.
 *
 * Used during loading to enumerate the artifact files produced by extraction, along with their
 * item type and record count, so the loader knows what is available to process.
 */
export interface StatsFileObject {
  /** Identifier of the artifact/file. */
  id: string;
  /** External item type contained in the file (e.g. the record type being loaded). */
  item_type: string;
  /** Name of the file. */
  file_name: string;
  /** Number of records in the file, as a string. */
  count: string;
}

/**
 * Loader-side view of a file to be loaded, tracking its processing progress.
 *
 * Used to drive and resume loading of a single data file: it records how many lines exist, the next
 * line to process, and whether the file has been fully consumed.
 */
export interface FileToLoad {
  /** Identifier of the artifact/file. */
  id: string;
  /** Name of the file. */
  file_name: string;
  /** External item type contained in the file. */
  itemType: string;
  /** Total number of records in the file. */
  count: number;
  /** Index of the next line/record to process; used to resume loading across batches. */
  lineToProcess: number;
  /** Whether all records in the file have been loaded. */
  completed: boolean;
}

/**
 * An attachment to be loaded into the external system, with its source metadata and parent links.
 *
 * Used by attachment loading to describe a single file (location, type, size, validity window,
 * audit fields) and the DevRev/external parent it belongs to.
 */
export interface ExternalSystemAttachment {
  reference_id: DonV2;
  parent_type: string;
  parent_reference_id: DonV2;
  file_name: string;
  file_type: string;
  file_size: number;
  url: string;
  valid_until: string;
  created_by_id: string;
  created_date: string;
  modified_by_id: string;
  modified_date: string;
  parent_id?: string;
  grand_parent_id?: string;
}

/**
 * A single item to be loaded into the external system.
 *
 * Used during loading to carry the DevRev (and optional external) identifiers, audit timestamps,
 * and the system-specific payload for one record.
 *
 * Note: this interface is declared twice in this file with identical members (TypeScript merges
 * the declarations); the duplicate is redundant — see report.
 */
export interface ExternalSystemItem {
  /** Identifiers linking this item to DevRev and, when known, the external system. */
  id: {
    /** DevRev object identifier (DON). */
    devrev: DonV2;
    /** External system identifier, present once the item exists in the external system. */
    external?: string;
  };
  /** Creation timestamp of the item. */
  created_date: string;
  /** Last-modified timestamp of the item. */
  modified_date: string;
  /** System-specific record payload. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

export interface ExternalSystemItem {
  id: {
    devrev: DonV2;
    external?: string;
  };
  created_date: string;
  modified_date: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
}

/**
 * Arguments passed to an external-system loading function for a single item.
 *
 * Used to give create/update handlers the item to load, the ID mappers for resolving DevRev <-> external
 * references, and the current AirSync event for auth/context.
 *
 * @typeParam Type - The shape of the item being loaded.
 */
export interface ExternalSystemItemLoadingParams<Type> {
  item: Type;
  mappers: Mappers;
  event: AirSyncEvent;
}

/**
 * Result returned by an external-system loading function for a single item.
 *
 * Used to report the outcome of a create/update: the resulting external id, an error message,
 * the item's modified date, or a delay (in seconds) when the external system is rate limiting.
 */
export interface ExternalSystemItemLoadingResponse {
  /** External system id of the loaded item, when the operation succeeded. */
  id?: string;
  /** Error message when the operation failed. */
  error?: string;
  /** Modified timestamp reported by the external system after the operation. */
  modifiedDate?: string;
  /** Suggested delay in seconds before retrying, set when rate limited. */
  delay?: number;
}

/**
 * Record of an item that was loaded into the external system.
 *
 * Used to persist the outcome of a load (external id, error, modified date) for reporting and
 * subsequent runs.
 */
export interface ExternalSystemItemLoadedItem {
  /** External system id of the loaded item. */
  id?: string;
  /** Error message if loading the item failed. */
  error?: string;
  /** Modified timestamp reported by the external system. */
  modifiedDate?: string;
}

/**
 * A handler that loads a single item into the external system.
 *
 * Used to implement the create or update behavior for an item type; receives the item, ID mappers,
 * and event, and resolves with the loading outcome.
 *
 * @typeParam Item - The shape of the item to load.
 * @returns Promise resolving to the ExternalSystemItemLoadingResponse for the item.
 */
export type ExternalSystemLoadingFunction<Item> = ({
  item,
  mappers,
  event,
}: ExternalSystemItemLoadingParams<Item>) => Promise<ExternalSystemItemLoadingResponse>;

/**
 * Registration of an item type and the functions that load it.
 *
 * Used to tell the loader, for a given external item type, how to create and update records in the
 * external system.
 */
export interface ItemTypeToLoad {
  /** External item type these handlers apply to. */
  itemType: string;
  /** Handler that creates a new record in the external system. */
  create: ExternalSystemLoadingFunction<ExternalSystemItem>;
  /** Handler that updates an existing record in the external system. */
  update: ExternalSystemLoadingFunction<ExternalSystemItem>;
  // requiresSecondPass: boolean;
}

/**
 * Parameters bundling the full set of item-type loaders for a loading run.
 *
 * Used to pass the configured list of loadable item types into the loading entry point.
 */
export interface ItemTypesToLoadParams {
  /** The item types to load, each with its create/update handlers. */
  itemTypesToLoad: ItemTypeToLoad[];
}

/**
 * Per-item-type counters summarizing the outcome of a loading run.
 *
 * Used to report, for one item type, how many records were created/updated/skipped/deleted/failed.
 */
export interface LoaderReport {
  /** External item type this report covers. */
  item_type: string;
  /** Number of records created. */
  [ActionType.CREATED]?: number;
  /** Number of records updated. */
  [ActionType.UPDATED]?: number;
  /** Number of records skipped (no-op). */
  [ActionType.SKIPPED]?: number;
  /** Number of records deleted. */
  [ActionType.DELETED]?: number;
  /** Number of records that failed to load. */
  [ActionType.FAILED]?: number;
}

/**
 * Signals that the external system is rate limiting and loading should pause.
 *
 * Used to propagate a back-off duration from a loading function up to the loader.
 */
export interface RateLimited {
  /** Number of seconds to wait before resuming. */
  delay: number;
}

/**
 * Result of loading a single item, capturing success report, error, or rate-limit signal.
 *
 * Used internally by the loader to aggregate per-item outcomes.
 */
export interface LoadItemResponse {
  /** Error record when the item could not be loaded. */
  error?: ErrorRecord;
  /** Per-type counters contributed by this item. */
  report?: LoaderReport;
  /** Rate-limit signal when the external system is throttling. */
  rateLimit?: RateLimited;
}

/**
 * Aggregate result of loading one or more item types.
 *
 * Used to return the per-type reports and the list of processed files at the end of a loading phase.
 */
export interface LoadItemTypesResponse {
  /** Per-item-type loading reports. */
  reports: LoaderReport[];
  /** Names of the data files that were processed. */
  processed_files: string[];
}

/**
 * The kinds of actions a loader can perform on a record, used as report counter keys.
 *
 * Used to key {@link LoaderReport} counters and to classify the outcome of each loaded item.
 */
export enum ActionType {
  /** A new record was created in the external system. */
  CREATED = 'created',
  /** An existing record was updated. */
  UPDATED = 'updated',
  /** The record required no change. */
  SKIPPED = 'skipped',
  /** The record was deleted. */
  DELETED = 'deleted',
  /** Loading the record failed. */
  FAILED = 'failed',
}

/** A DevRev object identifier (DON), represented as a string. */
export type DonV2 = string;

/**
 * A sync mapper record linking external and DevRev identifiers for one mapping.
 *
 * Used to track the correspondence between external ids, secondary ids, and DevRev ids, along with
 * status, for sync operations.
 */
export type SyncMapperRecord = {
  /** External system identifiers for the mapped item. */
  external_ids: string[];
  /** Secondary external identifiers (e.g. alternate keys). */
  secondary_ids: string[];
  /** DevRev object identifiers for the mapped item. */
  devrev_ids: string[];
  /** Status values associated with the mapping. */
  status: string[];
  /** Input file the record was sourced from, when applicable. */
  input_file?: string;
};

/**
 * Outgoing event types reported by the loading phases.
 *
 * Used as the event_type when a loader emits control messages for data loading, attachment loading,
 * and loader-state deletion (progress / delayed / done / error), plus a fallback for unrecognized events.
 */
export enum LoaderEventType {
  DataLoadingProgress = 'DATA_LOADING_PROGRESS',
  DataLoadingDelayed = 'DATA_LOADING_DELAYED',
  DataLoadingDone = 'DATA_LOADING_DONE',
  DataLoadingError = 'DATA_LOADING_ERROR',

  AttachmentLoadingProgress = 'ATTACHMENT_LOADING_PROGRESS',
  AttachmentLoadingDelayed = 'ATTACHMENT_LOADING_DELAYED',
  AttachmentLoadingDone = 'ATTACHMENT_LOADING_DONE',
  AttachmentLoadingError = 'ATTACHMENT_LOADING_ERROR',

  LoaderStateDeletionDone = 'LOADER_STATE_DELETION_DONE',
  LoaderStateDeletionError = 'LOADER_STATE_DELETION_ERROR',

  LoaderAttachmentStateDeletionDone = 'LOADER_ATTACHMENT_STATE_DELETION_DONE',
  LoaderAttachmentStateDeletionError = 'LOADER_ATTACHMENT_STATE_DELETION_ERROR',

  UnknownEventType = 'UNKNOWN_EVENT_TYPE',
}
