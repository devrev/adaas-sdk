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
  /**
   * Optional map that labels values in `external_ids` with their usage context.
   * Use for example when an external system requires different identifiers for different API calls
   * (for example, a UUID for one endpoint and a login username for another).
   *
   * Example:
   *   external_ids: ["2a1c...-uuid", "john_doe"]
   *   secondary_ids: { "username": "john_doe" }
   *
   * Note: Values in `secondary_ids` are not indexed. If you need to look up by a
   * secondary value (e.g., username), you must also include that value in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  /** DevRev entity IDs to add */
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  /**
   * Optionally populated with the file name of the input file that contains the
   * object data. Can be populated on create and on update of the object to help
   * in finding the object later if some debugging is needed.
   */
  input_files?: {
    add: string[];
  };
  /**
   * Records external-system changes to prevent update loops.
   * When you create/update the object in the external system during loading,
   * add that object's modified_date here. Later, when the object is extracted
   * and the DevRev Loader evaluates whether to apply it, if the modified_date
   * is present in this list the update is skipped (because the change
   * originated in DevRev).
   */
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  /**
   * Free-form data storage for your use. Store any additional information here.
   */
  extra_data?: string;
}

/**
 * Represents a sync mapper record that links external system entities to DevRev entities.
 */
export interface SyncMapperRecord {
  id: DonV2;
  /** Array of external system IDs that map to the same DevRev object */
  external_ids: string[];
  /**
   * Optional map that labels values in `external_ids` with their usage context.
   * Use when an external system requires different identifiers for different API calls
   * (for example, a UUID for one endpoint and a login username for another).
   *
   * Example:
   *   external_ids: ["2a1c...-uuid", "john_doe"]
   *   secondary_ids: { "username": "john_doe" }
   *
   * Note: Values in `secondary_ids` are not indexed. If you need to look up by a
   * secondary value (e.g., username), you must also include that value in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  /** Array of DevRev entity IDs this mapping points to */
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  /**
   * Optional file name where the object data was found.
   * Useful for debugging - helps locate the source of object data later.
   */
  input_files?: string[];
  /**
   * Records external-system changes to prevent update loops.
   * When the Loader writes to the external system, store the object's
   * modified_date here. During the next sync back to DevRev, if the extracted
   * object's modified_date exists in this list the update is skipped (avoids
   * re-applying a DevRev-originated change).
   */
  external_versions?: SyncMapperRecordExternalVersion[];
  /**
   * Free-form data storage for your use. Store any additional information here.
   * Completely opaque to the platform - use however you need.
   */
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
  /**
   * Optional map that labels values in `external_ids` with their usage context.
   * Use when an external system requires different identifiers for different API calls
   * (for example, a UUID for one endpoint and a login username for another).
   *
   * Example:
   *   external_ids: ["2a1c...-uuid", "john_doe"]
   *   secondary_ids: { "username": "john_doe" }
   *
   * Note: Values in `secondary_ids` are not indexed. If you need to look up by a
   * secondary value (e.g., username), you must also include that value in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  /** Array of DevRev entity IDs this mapping points to */
  targets: DonV2[];
  status: SyncMapperRecordStatus;
  /**
   * Input file names where the object was encountered.
   * Used for observability and tracking.
   */
  input_files?: string[];
  /**
   * External version markers used to avoid update loops.
   * After creating or updating the object in the external system, add its
   * modified_date here. On subsequent extraction, the Loader skips applying the
   * update if the modified_date is present (change originated in DevRev).
   */
  external_versions?: SyncMapperRecordExternalVersion[];
  /**
   * Opaque data for storing additional client-specific information.
   * Fully managed by snapin authors.
   */
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
  /**
   * Optional map that labels values in `external_ids` with their usage context.
   * Use when an external system requires different identifiers for different API calls
   * (for example, a UUID for one endpoint and a login username for another).
   *
   * Example:
   *   external_ids: ["2a1c...-uuid", "john_doe"]
   *   secondary_ids: { "username": "john_doe" }
   *
   * Note: Values in `secondary_ids` are not indexed. If you need to look up by a
   * secondary value (e.g., username), you must also include that value in `external_ids`.
   */
  secondary_ids?: Record<string, string>;
  /** DevRev entity IDs to add to the existing mapping */
  targets: {
    add: DonV2[];
  };
  status: SyncMapperRecordStatus;
  /**
   * Input file names where the object was encountered.
   * Used for observability and tracking.
   */
  input_files?: {
    add: string[];
  };
  /**
   * External version markers used to avoid update loops.
   * After creating or updating the object in the external system, add its
   * modified_date here. On subsequent extraction, the Loader skips applying the
   * update if the modified_date is present (change originated in DevRev).
   */
  external_versions?: {
    add: SyncMapperRecordExternalVersion[];
  };
  /**
   * Opaque data for storing additional client-specific information.
   * Fully managed by snapin authors.
   */
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
  /** The mapping is active and operational (default) */
  OPERATIONAL = 'operational',
  /** The mapping was filtered out by user filter settings */
  FILTERED = 'filtered',
  /**
   * The external object should be ignored in sync operations.
   * Use to prevent objects from being created or updated in DevRev.
   */
  IGNORED = 'ignored',
}

/**
 * External version tracking to prevent update loops.
 * Used to identify changes that originated from your system.
 */
export interface SyncMapperRecordExternalVersion {
  /** Sync recipe version at the time the external change was written */
  recipe_version: number;
  /** External system modified timestamp (ISO 8601 string) used for loop detection */
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
  /** The type of DevRev entity to look for */
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
