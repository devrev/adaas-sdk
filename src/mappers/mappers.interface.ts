import { AirdropEvent } from '../types';
import { DonV2 } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * Configuration interface for creating a Mappers instance.
 */
export interface MappersFactoryInterface {
  event: AirdropEvent;
  options?: WorkerAdapterOptions;
}

/**
 * Parameters for updating a sync mapper record.
 */
export interface UpdateSyncMapperRecordParams {
  /** External system IDs to add */
  external_ids: {
    add: string[];
  };
  /** TODO: Document secondary_ids usage */
  secondary_ids?: Record<string, string>;
  /** DevRev entity IDs to add */
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  /** TODO: Document input_files usage */
  input_files?: {
    add: string[];
  };
  /** TODO: Document external_versions usage */
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  /** TODO: Document extra_data usage and format */
  extra_data?: string;
}

/**
 * Represents a sync mapper record that links external system entities to DevRev entities.
 */
export interface SyncMapperRecord {
  id: DonV2;
  /** Array of external system IDs */
  external_ids: string[];
  /** TODO: Document secondary_ids usage */
  secondary_ids?: Record<string, string>;
  /** Array of DevRev entity IDs this mapping points to */
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  /** TODO: Document input_files usage */
  input_files?: string[];
  /** TODO: Document external_versions usage */
  external_versions?: SyncMapperRecordExternalVersion[];
  /** TODO: Document extra_data usage and format */
  extra_data?: string;
}

/**
 * Parameters for retrieving a sync mapper record by DevRev target ID.
 */
export interface MappersGetByTargetIdParams {
  /** The sync unit ID that scopes the synchronization context */
  sync_unit: DonV2;
  /** The DevRev entity ID to look up */
  target: DonV2;
}

/**
 * Response containing a sync mapper record retrieved by target ID.
 */
export interface MappersGetByTargetIdResponse {
  sync_mapper_record: SyncMapperRecord;
}

/**
 * Parameters for creating a new sync mapper record.
 */
export interface MappersCreateParams {
  /** The sync unit ID that scopes the synchronization context */
  sync_unit: DonV2;
  /** Array of external system identifiers */
  external_ids: string[];
  /** TODO: Document secondary_ids usage */
  secondary_ids?: Record<string, string>;
  /** Array of DevRev entity IDs this mapping points to */
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  /** TODO: Document input_files usage */
  input_files?: string[];
  /** TODO: Document external_versions usage */
  external_versions?: SyncMapperRecordExternalVersion[];
  /** TODO: Document extra_data usage and format */
  extra_data?: string;
}

/**
 * Response containing the newly created sync mapper record.
 */
export interface MappersCreateResponse {
  sync_mapper_record: SyncMapperRecord;
}

/**
 * Parameters for updating an existing sync mapper record.
 */
export interface MappersUpdateParams {
  /** The ID of the existing sync mapper record to update */
  id: DonV2;
  /** The sync unit ID that scopes the synchronization context */
  sync_unit: DonV2;
  /** External system IDs to add to the existing mapping */
  external_ids: {
    add: string[];
  };
  /** TODO: Document secondary_ids usage */
  secondary_ids?: Record<string, string>;
  /** DevRev entity IDs to add to the existing mapping */
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  /** TODO: Document input_files usage */
  input_files?: {
    add: string[];
  };
  /** TODO: Document external_versions usage */
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  /** TODO: Document extra_data usage and format */
  extra_data?: string;
}

/**
 * Response containing the updated sync mapper record.
 */
export interface MappersUpdateResponse {
  sync_mapper_record: SyncMapperRecord;
}

/**
 * Status of a sync mapper record indicating its operational state.
 */
export enum SyncMapperRecordStatus {
  /** The mapping is active and operational */
  OPERATIONAL = 'operational',
  /** TODO: Document when FILTERED status is used */
  FILTERED = 'filtered',
  /** TODO: Document when IGNORED status is used */
  IGNORED = 'ignored',
}

/**
 * TODO: Document SyncMapperRecordExternalVersion - appears to track external system version information
 */
export interface SyncMapperRecordExternalVersion {
  /** TODO: Document recipe_version meaning */
  recipe_version: number;
  modified_date: string;
}

/**
 * Parameters for retrieving a sync mapper record by external system ID.
 */
export interface MappersGetByExternalIdParams {
  /** The sync unit ID that scopes the synchronization context */
  sync_unit: DonV2;
  /** The identifier from the external system */
  external_id: string;
  target_type: SyncMapperRecordTargetType;
}

/**
 * Types of DevRev entities that can be targets in sync mapper records.
 */
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

/**
 * Response containing a sync mapper record retrieved by external ID.
 */
export interface MappersGetByExternalIdResponse {
  sync_mapper_record: SyncMapperRecord;
}
