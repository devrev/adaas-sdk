import { AirdropEvent } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * Configuration interface for creating an UnresolvedReferences instance.
 */
export interface UnresolvedReferencesFactoryInterface {
  event: AirdropEvent;
  options?: WorkerAdapterOptions;
}

/**
 * Scopes an UnresolvedReferences request to one external system. Unlike
 * RecordManager's record-merging RPCs (proxied through snapin-manager, which
 * resolves this server-side from SyncContext - see record-manager.ts), the
 * UnresolvedReferences RPCs' calling contract has not been verified against
 * a snapin-manager proxy, so this field is kept pending that check. Mirrors
 * the platform's SyncExternalSystemSpecifier
 * (devrev/airdrop-record-manager api/composite.proto).
 */
export interface UnresolvedReferencesExternalSystemSpecifier {
  external_system_type: string;
  external_system_name: string;
  external_system_id: string;
  import_slug?: string;
  snap_in_slug?: string;
}

/**
 * Numeric object-type enum required by the record-manager's
 * referenced_devrev_type / object_devrev_type fields. Mirrors
 * SyncMapperRecordMappedObjectType in devrev/airdrop-record-manager
 * client/enums.go - these numeric values are stored in the database and
 * must not be changed. Kept separate from the SDK's existing
 * SyncMapperRecordTargetType (a string enum, src/mappers/mappers.interface.ts)
 * since the platform's mapped-object-type enum has no exposed string form.
 */
export enum UnresolvedReferenceDevRevType {
  USER = 1,
  TAG = 2,
  WORK = 3,
  COMMENT = 4,
  LINK = 5,
  ARTIFACT = 6,
  ACCOUNT = 7,
  REV_ORG = 8,
  CONVERSATION = 9,
  PART = 10,
  ARTICLE = 11,
  DIRECTORY = 12,
  CUSTOM_OBJECT = 13,
  GROUP = 14,
  OBJECT_MEMBER = 15,
  CHAT = 16,
  INCIDENT = 17,
  ROLE = 18,
  ROLE_SET = 19,
  ACCESS_CONTROL_ENTRY = 20,
  AIRDROP_PLATFORM_GROUP = 21,
  MEETING = 23,
  VISTA = 26,
  VISTA_GROUP_ITEM = 27,
  TEAM = 28,
}

/**
 * One occurrence of a reference in a field of a source object that could
 * not be resolved to an existing mapped object.
 */
export interface UnresolvedReference {
  /** Name of the field in the source object that holds the reference. */
  devrev_field_name: string;
  /**
   * External ID of the referenced object, whose reference failed to
   * resolve. For array/list fields, identify the needed element by value
   * rather than by position, since the index can change.
   */
  referenced_external_id: string;
  /**
   * Object type of the referenced object, if known. Passing this narrows
   * the mapper lookup; when omitted the record-manager resolves by
   * referenced_external_id alone within the same sync-mapper scope.
   */
  referenced_devrev_type?: UnresolvedReferenceDevRevType;
  /**
   * The literal value written to this field's slot in place of the
   * reference that failed to resolve (e.g. a default user ID), when a
   * placeholder was substituted rather than leaving the slot empty. Opaque
   * to the record-manager - round-tripped as-is.
   */
  fallback_value?: string;
  /** Opaque, caller-defined payload for any future per-occurrence metadata. */
  extra_data?: Record<string, unknown>;
}

/**
 * A reference the caller has successfully resolved and that should be
 * removed from the unresolved-references list.
 */
export interface ResolvedReference {
  devrev_field_name: string;
  referenced_external_id: string;
  /**
   * When present, only the unresolved reference with this exact
   * referenced_devrev_type is deleted. When omitted, only unresolved
   * references with no referenced_devrev_type set are deleted.
   */
  referenced_devrev_type?: UnresolvedReferenceDevRevType;
}

/**
 * Params for UnresolvedReferencesSet: records or updates the set of
 * unresolved references for one source object, replacing any prior set for
 * fields present in unresolved_references (occurrences from a prior call
 * that are no longer present are removed).
 */
export interface UnresolvedReferencesSetParams {
  external_system_specifier: UnresolvedReferencesExternalSystemSpecifier;
  object_external_id: string;
  /** Object type of the source object. Numeric value per UnresolvedReferenceDevRevType. */
  object_devrev_type: UnresolvedReferenceDevRevType;
  sync_run_id: string;
  sync_unit_id: string;
  unresolved_references: UnresolvedReference[];
}

export type UnresolvedReferencesSetResponse = Record<string, never>;

/**
 * Params for UnresolvedReferencesResolve: removes the given occurrences from
 * the unresolved-references list for one source object, since the caller
 * has since resolved them (e.g. a mapper record now exists for the
 * referenced object).
 */
export interface UnresolvedReferencesResolveParams {
  external_system_specifier: UnresolvedReferencesExternalSystemSpecifier;
  object_external_id: string;
  object_devrev_type: UnresolvedReferenceDevRevType;
  resolved_references: ResolvedReference[];
}

export type UnresolvedReferencesResolveResponse = Record<string, never>;

/**
 * One source object's full outstanding unresolved-reference occurrences.
 */
export interface ObjectWithUnresolvedReferences {
  object_external_id: string;
  object_devrev_type: UnresolvedReferenceDevRevType;
  unresolved_references: UnresolvedReference[];
}

/**
 * Params for UnresolvedReferencesList: lists resolvable unresolved
 * references (those whose referenced object now has a usable mapper
 * record), optionally filtered by object_devrev_type. Paginated; note (per
 * platform docs) that resolving entries shifts subsequent pages, so callers
 * that read-then-resolve a page should always re-fetch the first page.
 */
export interface UnresolvedReferencesListParams {
  external_system_specifier: UnresolvedReferencesExternalSystemSpecifier;
  object_devrev_type?: UnresolvedReferenceDevRevType;
  page?: number;
  limit?: number;
}

export interface UnresolvedReferencesListResponse {
  objects: ObjectWithUnresolvedReferences[];
  is_last_page: boolean;
}
