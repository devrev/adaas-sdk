import { Mappers } from '../mappers/mappers';
import { ErrorRecord } from './common';
import { AirdropEvent } from './extraction';

export interface StatsFileObject {
  id: string;
  item_type: string;
  file_name: string;
  count: string;
}

export interface FileToLoad {
  id: string;
  file_name: string;
  itemType: string;
  count: number;
  lineToProcess: number;
  completed: boolean;
}

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

export interface ExternalSystemItemLoadingParams<Type> {
  item: Type;
  mappers: Mappers;
  event: AirdropEvent;
}

export interface ExternalSystemItemLoadingResponse {
  id?: string;
  error?: string;
  modifiedDate?: string;
  delay?: number;
}

export interface ExternalSystemItemLoadedItem {
  id?: string;
  error?: string;
  modifiedDate?: string;
}

export type ExternalSystemLoadingFunction<Item> = ({
  item,
  mappers,
  event,
}: ExternalSystemItemLoadingParams<Item>) => Promise<ExternalSystemItemLoadingResponse>;

/**
 * ENH-7536 (External-Loader / DR2E field-level merge, proposal §5.2):
 * response shape for ItemTypeToLoad.read - unlike create/update, a read
 * needs to return the current external object's data so the SDK can diff it
 * against the last-seen snapshot.
 */
export interface ExternalSystemItemReadingResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any;
  error?: string;
  delay?: number;
}

export type ExternalSystemReadingFunction<Item> = ({
  item,
  mappers,
  event,
}: ExternalSystemItemLoadingParams<Item>) => Promise<ExternalSystemItemReadingResponse>;

export interface ItemTypeToLoad {
  itemType: string;
  create: ExternalSystemLoadingFunction<ExternalSystemItem>;
  update: ExternalSystemLoadingFunction<ExternalSystemItem>;
  /**
   * ENH-7536 (External-Loader / DR2E field-level merge, proposal §5.2):
   * optional pre-write read of the item's current state in the external
   * system, used to diff against the last-seen snapshot before applying
   * DevRev-originated changes. Optional and additive - item types that don't
   * supply it are skipped by field-level merge and keep today's whole-object
   * `update` behavior even when the feature flag is on.
   *
   * PLATFORM CHECK REQUIRED (ISS-297298): the diff computed via this hook is
   * not currently used to resolve conflicts - conflict-resolution strategy
   * and primary-system granularity are owned by the platform and unresolved
   * as of this writing. See WorkerAdapter.loadItem.
   */
  read?: ExternalSystemReadingFunction<ExternalSystemItem>;
  // requiresSecondPass: boolean;
}

export interface ItemTypesToLoadParams {
  itemTypesToLoad: ItemTypeToLoad[];
}

export interface LoaderReport {
  item_type: string;
  [ActionType.CREATED]?: number;
  [ActionType.UPDATED]?: number;
  [ActionType.SKIPPED]?: number;
  [ActionType.DELETED]?: number;
  [ActionType.FAILED]?: number;
}

export interface RateLimited {
  delay: number;
}

export interface LoadItemResponse {
  error?: ErrorRecord;
  report?: LoaderReport;
  rateLimit?: RateLimited;
}

export interface LoadItemTypesResponse {
  reports: LoaderReport[];
  processed_files: string[];
}

export enum ActionType {
  CREATED = 'created',
  UPDATED = 'updated',
  SKIPPED = 'skipped',
  DELETED = 'deleted',
  FAILED = 'failed',
}

export type DonV2 = string;

export type SyncMapperRecord = {
  external_ids: string[];
  secondary_ids: string[];
  devrev_ids: string[];
  status: string[];
  input_file?: string;
};

/* eslint-disable @typescript-eslint/no-duplicate-enum-values */
export enum LoaderEventType {
  DataLoadingProgress = 'DATA_LOADING_PROGRESS',
  /**
   * @deprecated This was a typo. Use DataLoadingDelayed for the corrected spelling
   */
  DataLoadingDelay = 'DATA_LOADING_DELAYED',
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
  DataLoadingDelayed = 'DATA_LOADING_DELAYED',

  /**
   * @deprecated Use AttachmentsLoadingProgress instead (note: singular changed to plural)
   */
  AttachmentsLoadingProgress = 'ATTACHMENT_LOADING_PROGRESS',
  /**
   * @deprecated Use AttachmentsLoadingDelayed instead (note: singular changed to plural)
   */
  AttachmentsLoadingDelayed = 'ATTACHMENT_LOADING_DELAYED',
  /**
   * @deprecated Use AttachmentsLoadingDone instead (note: singular changed to plural)
   */
  AttachmentsLoadingDone = 'ATTACHMENT_LOADING_DONE',
  /**
   * @deprecated Use AttachmentsLoadingError instead (note: singular changed to plural)
   */
  AttachmentsLoadingError = 'ATTACHMENT_LOADING_ERROR',
}
