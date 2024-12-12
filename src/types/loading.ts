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

export interface ExternalSystemItemLoadingParams {
  item: ExternalSystemItem;
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

export type ExternalSystemLoadingFunction = ({
  item,
  mappers,
  event,
}: ExternalSystemItemLoadingParams) => Promise<ExternalSystemItemLoadingResponse>;

export interface ItemTypeToLoad {
  itemType: string;
  create: ExternalSystemLoadingFunction;
  update: ExternalSystemLoadingFunction;
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
  LoaderStateDeletionDone = 'LOADER_STATE_DELETION_DONE',
  LoaderStateDeletionError = 'LOADER_STATE_DELETION_ERROR',
  UnknownEventType = 'UNKNOWN_EVENT_TYPE',
}
