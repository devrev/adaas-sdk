import { AirdropEvent } from '../types';
import { DonV2 } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

export interface MappersFactoryInterface {
  event: AirdropEvent;
  options?: WorkerAdapterOptions;
}

export interface UpdateSyncMapperRecordParams {
  external_ids: {
    add: string[];
  };
  secondary_ids?: Record<string, string>;
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  input_files?: {
    add: string[];
  };
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  extra_data?: string;
}

export interface SyncMapperRecord {
  id: DonV2;
  external_ids: string[];
  secondary_ids?: Record<string, string>;
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  input_files?: string[];
  external_versions?: SyncMapperRecordExternalVersion[];
  extra_data?: string;
}

export interface MappersGetByTargetIdParams {
  sync_unit: DonV2;
  target: DonV2;
}

export interface MappersGetByTargetIdResponse {
  sync_mapper_record: SyncMapperRecord;
}

export interface MappersCreateParams {
  sync_unit: DonV2;
  external_ids: string[];
  secondary_ids?: Record<string, string>;
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  input_files?: string[];
  external_versions?: SyncMapperRecordExternalVersion[];
  extra_data?: string;
}

export interface MappersCreateResponse {
  sync_mapper_record: SyncMapperRecord;
}

export interface MappersUpdateParams {
  id: DonV2;
  sync_unit: DonV2;
  external_ids: {
    add: string[];
  };
  secondary_ids?: Record<string, string>;
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  input_files?: {
    add: string[];
  };
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  extra_data?: string;
}

export interface MappersUpdateResponse {
  sync_mapper_record: SyncMapperRecord;
}

export enum SyncMapperRecordStatus {
  OPERATIONAL = 'operational',
  FILTERED = 'filtered',
  IGNORED = 'ignored',
}

export interface SyncMapperRecordExternalVersion {
  recipe_version: number;
  modified_date: string;
}
