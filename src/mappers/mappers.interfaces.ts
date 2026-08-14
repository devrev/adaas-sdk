import { AirSyncEvent } from '../types/extraction';
import { DonV2 } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

export interface MappersFactoryInterface {
  event: AirSyncEvent;
  options?: WorkerAdapterOptions;
}

export interface UpdateSyncMapperRecordParams {
  external_ids: {
    add: string[];
  };
  /**
   * Labels values in `external_ids` with their usage context (e.g. a UUID for
   * one API call, a login username for another). Not indexed: to look up by a
   * secondary value it must also be present in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  /** Input file name(s) containing the object data; helps later debugging. */
  input_files?: {
    add: string[];
  };
  /**
   * Prevents update loops: after writing the object to the external system,
   * add its modified_date here. The Loader skips extracted updates whose
   * modified_date is listed (the change originated in DevRev).
   */
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  /** Free-form storage; opaque to the platform. */
  extra_data?: string;
}

/** Links external system entities to DevRev entities. */
export interface SyncMapperRecord {
  id: DonV2;
  external_ids: string[];
  /**
   * Labels values in `external_ids` with their usage context (e.g. a UUID for
   * one API call, a login username for another). Not indexed: to look up by a
   * secondary value it must also be present in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  /** Input file name(s) containing the object data; helps later debugging. */
  input_files?: string[];
  /**
   * Prevents update loops: after writing the object to the external system,
   * its modified_date is stored here. The Loader skips extracted updates whose
   * modified_date is listed (the change originated in DevRev).
   */
  external_versions?: SyncMapperRecordExternalVersion[];
  /** Free-form storage; opaque to the platform. */
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
  /**
   * Labels values in `external_ids` with their usage context (e.g. a UUID for
   * one API call, a login username for another). Not indexed: to look up by a
   * secondary value it must also be present in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  /** Input file name(s) containing the object data; helps later debugging. */
  input_files?: string[];
  /**
   * Prevents update loops: after writing the object to the external system,
   * add its modified_date here. The Loader skips extracted updates whose
   * modified_date is listed (the change originated in DevRev).
   */
  external_versions?: SyncMapperRecordExternalVersion[];
  /** Free-form storage; opaque to the platform. */
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
  /**
   * Labels values in `external_ids` with their usage context (e.g. a UUID for
   * one API call, a login username for another). Not indexed: to look up by a
   * secondary value it must also be present in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  /** Input file name(s) containing the object data; helps later debugging. */
  input_files?: {
    add: string[];
  };
  /**
   * Prevents update loops: after writing the object to the external system,
   * add its modified_date here. The Loader skips extracted updates whose
   * modified_date is listed (the change originated in DevRev).
   */
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  /** Free-form storage; opaque to the platform. */
  extra_data?: string;
}

export interface MappersUpdateResponse {
  sync_mapper_record: SyncMapperRecord;
}

export enum SyncMapperRecordStatus {
  /** The mapping is active and operational (default) */
  OPERATIONAL = 'operational',
  /** The mapping was filtered out by user filter settings */
  FILTERED = 'filtered',
  /** Ignore the external object in sync; prevents create/update in DevRev. */
  IGNORED = 'ignored',
}

/** Marks external changes as DevRev-originated to prevent update loops. */
export interface SyncMapperRecordExternalVersion {
  /** Sync recipe version at the time the external change was written */
  recipe_version: number;
  /** External system modified timestamp (ISO 8601 string) used for loop detection */
  modified_date: string;
}

export interface MappersGetByExternalIdParams {
  sync_unit: DonV2;
  external_id: string;
  target_type: SyncMapperRecordTargetType;
}

export enum SyncMapperRecordTargetType {
  ACCESS_CONTROL_ENTRY = 'access_control_entry',
  ACCOUNT = 'account',
  AIRDROP_AUTHORIZATION_POLICY = 'airdrop_authorization_policy',
  AIRDROP_FIELD_AUTHORIZATION_POLICY = 'airdrop_field_authorization_policy',
  AIRDROP_PLATFORM_GROUP = 'airdrop_platform_group',
  ARTICLE = 'article',
  ARTIFACT = 'artifact',
  CHAT = 'chat',
  CONVERSATION = 'conversation',
  CUSTOM_OBJECT = 'custom_object',
  DIRECTORY = 'directory',
  GROUP = 'group',
  INCIDENT = 'incident',
  LINK = 'link',
  MEETING = 'meeting',
  OBJECT_MEMBER = 'object_member',
  PART = 'part',
  REV_ORG = 'rev_org',
  ROLE = 'role',
  ROLE_SET = 'role_set',
  TAG = 'tag',
  TIMELINE_COMMENT = 'timeline_comment',
  USER = 'user',
  WORK = 'work',
}

export interface MappersGetByExternalIdResponse {
  sync_mapper_record: SyncMapperRecord;
}
