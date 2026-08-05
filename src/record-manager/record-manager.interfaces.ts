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
 * Uniquely identifies a record in the external system. Mirrors the
 * snapin-manager proxy's SyncExternalRecordIdentifier
 * (devrev/airdrop-snapin-manager api/service.proto,
 * devrev/airdrop-record-manager api/composite.proto).
 */
export interface RecordManagerExternalRecordIdentifier {
  external_record_id: string;
  external_record_type?: string;
  devrev_object_type?: number;
}

/**
 * Common fields every record-merging proxy request requires. `request_id`
 * and `dev_org_id` are populated by RecordManager from the event context -
 * callers only supply the object identity. `external_system_specifier` is
 * NOT part of this contract: the snapin-manager proxy resolves it
 * server-side from SyncContext (toRecordManagerSystemSpecifier in
 * internal/service/field_level_merging.go), so sending it would be ignored.
 */
export interface RecordManagerObjectIdentifier {
  devrev_object_id?: DonV2;
  external_object_identifier?: RecordManagerExternalRecordIdentifier;
}

/**
 * Params for ExtractorRecordMergingSet: overrides the stored
 * external-extractor-seen object and returns the diff of the supplied
 * external_object against the stored ExternalExtractorSeen and
 * ExternalLoaderAttempted objects. `external_object_identifier` is required
 * by the proto (ExternalObjectIdentifier field validator).
 */
export interface RecordManagerExtractorRecordMergingSetParams
  extends RecordManagerObjectIdentifier {
  external_object_identifier: RecordManagerExternalRecordIdentifier;
  external_object: Record<string, unknown>;
}

export interface RecordManagerExtractorRecordMergingSetResponse {
  external_object_diff: Record<string, unknown>;
}

/**
 * Params for LoaderRecordMergingSet: overrides the stored
 * external-loader-seen object and the external-loader-attempted object
 * (devrev_changes) in a single platform-side transaction.
 * `devrev_object_id` is required by the proto.
 */
export interface RecordManagerLoaderRecordMergingSetParams
  extends RecordManagerObjectIdentifier {
  devrev_object_id: DonV2;
  external_object: Record<string, unknown>;
  devrev_changes?: Record<string, unknown>;
}

export type RecordManagerLoaderRecordMergingSetResponse = Record<string, never>;

/**
 * Params for LoaderRecordMergingGet: reads the stored external-loader-seen
 * object and returns the fields that differ from the supplied
 * external_object. `devrev_object_id` is required by the proto.
 */
export interface RecordManagerLoaderRecordMergingGetParams
  extends RecordManagerObjectIdentifier {
  devrev_object_id: DonV2;
  external_object?: Record<string, unknown>;
}

export interface RecordManagerLoaderRecordMergingGetResponse {
  external_object_diff: Record<string, unknown>;
}

/**
 * Params for the (not yet reachable) DevRevLoaderSeen get/set pair. The
 * record-manager RPCs (RecordDevRevLoaderSeenGet/Set) are fully implemented
 * on devrev/airdrop-record-manager main, but no snapin-manager proxy RPC
 * fronts them yet - see the class doc on RecordManager.
 */
export interface RecordManagerDevRevLoaderSeenGetParams
  extends RecordManagerObjectIdentifier {
  devrev_object_id: DonV2;
  devrev_object?: Record<string, unknown>;
}

export interface RecordManagerDevRevLoaderSeenGetResponse {
  devrev_object_diff: Record<string, unknown>;
}

export interface RecordManagerDevRevLoaderSeenSetParams
  extends RecordManagerObjectIdentifier {
  devrev_object_id: DonV2;
  devrev_object: Record<string, unknown>;
}

export type RecordManagerDevRevLoaderSeenSetResponse = Record<string, never>;
