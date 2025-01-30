import { AirdropEvent } from './extraction';
import { Mappers } from '../mappers/mappers';
import { ErrorRecord } from './common';

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

export interface ItemTypeToLoad {
  itemType: string;
  create: ExternalSystemLoadingFunction<ExternalSystemItem>;
  update: ExternalSystemLoadingFunction<ExternalSystemItem>;
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

export enum LoaderEventType {
  DataLoadingProgress = 'DATA_LOADING_PROGRESS',
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
}
