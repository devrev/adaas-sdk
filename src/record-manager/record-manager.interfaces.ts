import { AirdropEvent } from '../types/extraction';
import { DonV2 } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * Configuration interface for creating a RecordManager instance.
 */
export interface RecordManagerFactoryInterface {
  event: AirdropEvent;
  options?: WorkerAdapterOptions;
}

/**
 * Uniquely identifies a record in the external system.
 * Mirrors the platform's SyncExternalRecordIdentifier
 * (devrev/airdrop-record-manager api/composite.proto).
 */
export interface RecordManagerExternalRecordIdentifier {
  external_record_id: string;
  external_record_type?: string;
  devrev_object_type?: number;
}

/**
 * Scopes a record-manager request to one external system.
 * Mirrors the platform's SyncExternalSystemSpecifier
 * (devrev/airdrop-record-manager api/composite.proto); all fields are
 * already present on EventContext.
 */
export interface RecordManagerExternalSystemSpecifier {
  external_system_type: string;
  external_system_name: string;
  external_system_id: string;
  import_slug?: string;
  snap_in_slug?: string;
}

/**
 * Identifies the object a record-manager request/response is about. At
 * least one of devrev_id / external_identifier must be populated (enforced
 * platform-side).
 */
export interface RecordManagerObjectIdentifier {
  devrev_id?: DonV2;
  external_identifier?: RecordManagerExternalRecordIdentifier;
  external_system_specifier: RecordManagerExternalSystemSpecifier;
}

/**
 * Params for RecordDevRevLoaderSeenGet: reads the stored DevRev-loader-seen
 * object and returns the fields that differ from the supplied devrev_object.
 * If devrev_object is omitted, the endpoint returns the whole saved object.
 */
export interface RecordManagerDevRevLoaderSeenGetParams
  extends RecordManagerObjectIdentifier {
  devrev_object?: Record<string, unknown>;
}

export interface RecordManagerDevRevLoaderSeenGetResponse {
  devrev_object_diff: Record<string, unknown>;
}

/**
 * Params for RecordDevRevLoaderSeenSet: overrides the stored
 * DevRev-loader-seen object.
 */
export interface RecordManagerDevRevLoaderSeenSetParams
  extends RecordManagerObjectIdentifier {
  devrev_object: Record<string, unknown>;
}

export type RecordManagerDevRevLoaderSeenSetResponse = Record<string, never>;

/**
 * Params for RecordExternalLoaderSeenGet: reads the stored
 * external-loader-seen object and returns the fields that differ from the
 * supplied external_object. If external_object is omitted, the endpoint
 * returns the whole saved object.
 */
export interface RecordManagerExternalLoaderSeenGetParams
  extends RecordManagerObjectIdentifier {
  external_object?: Record<string, unknown>;
}

export interface RecordManagerExternalLoaderSeenGetResponse {
  external_object_diff: Record<string, unknown>;
}

/**
 * Params for RecordExternalLoaderSeenSet: overrides the stored
 * external-loader-seen object and the external-loader-attempted object in a
 * single platform-side transaction.
 */
export interface RecordManagerExternalLoaderSeenSetParams
  extends RecordManagerObjectIdentifier {
  external_object: Record<string, unknown>;
  devrev_changes?: Record<string, unknown>;
}

export type RecordManagerExternalLoaderSeenSetResponse = Record<string, never>;

/**
 * Params for RecordExternalExtractorSeenSet: overrides the stored
 * external-extractor-seen object and returns the diff of the supplied
 * external_object against the stored RecordExternalExtractorSeen and
 * RecordExternalLoaderAttempted objects
 * (Diff = external_object - ExternalExtractorSeen - ExternalLoaderAttempted).
 */
export interface RecordManagerExternalExtractorSeenSetParams
  extends RecordManagerObjectIdentifier {
  external_object: Record<string, unknown>;
}

export interface RecordManagerExternalExtractorSeenSetResponse {
  external_object_diff: Record<string, unknown>;
}
