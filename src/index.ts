// ────────────────────────────────────────────────────────────────────────────
// Public API barrel for @devrev/airsync-sdk. Single source of the public
// surface: every export is named explicitly (no `export *`), so any public API
// change shows up as a diff here.
// ────────────────────────────────────────────────────────────────────────────

// ── Entry points & adapters ──
export { ExtractionAdapter } from './multithreading/adapters/extraction-adapter';
export { LoadingAdapter } from './multithreading/adapters/loading-adapter';
export {
  processExtractionTask,
  processLoadingTask,
} from './multithreading/process-task';
export { spawn } from './multithreading/spawn/spawn';

// ── Worker contract types ──
export type {
  ExtractionScope,
  ProcessTaskInterface,
  SpawnFactoryInterface,
  SpawnInterface,
  TaskAdapterInterface,
  TaskResult,
  TaskStatus,
  WorkerAdapterInterface,
  WorkerAdapterOptions,
  WorkerPathOverrides,
} from './types/workers';

// ── Constants & enums ──
export { AirSyncDefaultItemTypes } from './common/constants';
export { UNBOUNDED_DATE_TIME_VALUE } from './common/constants';
export { ExtractionCommonError } from './types/errors';

// ── Domain mapping install ──
export { installInitialDomainMapping } from './state/install-initial-domain-mapping';

// ── Error formatting ──
export { serializeError } from './logger/logger';

// ── Common types ──
export type { ErrorRecord, InitialDomainMapping } from './types/common';
export { SyncMode } from './types/common';

// ── Extraction types ──
export type {
  AirSyncEvent,
  AirSyncMessage,
  ConnectionData,
  EventContext,
  EventData,
  ExternalProcessAttachmentFunction,
  ExternalSyncUnit,
  ExternalSystemAttachmentIteratorFunction,
  ExternalSystemAttachmentReducerFunction,
  ExternalSystemAttachmentStreamingFunction,
  ExternalSystemAttachmentStreamingParams,
  ExternalSystemAttachmentStreamingResponse,
  ExtractorEvent,
  HttpStreamResponse,
  ProcessAttachmentReturnType,
  TimeValue,
} from './types/extraction';
export {
  EventType,
  ExtractorEventType,
  InitialSyncScope,
  TimeUnit,
  TimeValueType,
} from './types/extraction';

// ── Loading types ──
export type {
  ExternalSystemAttachment,
  ExternalSystemItem,
  ExternalSystemItemLoadingParams,
  ExternalSystemItemLoadingResponse,
  ItemTypeToLoad,
} from './types/loading';
export { LoaderEventType } from './types/loading';

// ── Repo types ──
export type {
  Item,
  NormalizedAttachment,
  NormalizedItem,
  RepoInterface,
} from './repo/repo.interfaces';

// ── Mappers ──
export { Mappers } from './mappers/mappers';
export type {
  MappersCreateParams,
  MappersGetByExternalIdParams,
  MappersGetByTargetIdParams,
  MappersUpdateParams,
} from './mappers/mappers.interfaces';
export {
  SyncMapperRecordStatus,
  SyncMapperRecordTargetType,
} from './mappers/mappers.interfaces';

// ── Uploader types ──
export type {
  Artifact,
  ArtifactsPrepareResponse,
  SsorAttachment,
  StreamAttachmentsResponse,
  StreamResponse,
  UploadResponse,
} from './uploader/uploader.interfaces';

// ── External domain metadata types ──
export type {
  CollectionData,
  ConditionalPrivilegeData,
  CustomLinkData,
  CustomLinkNames,
  CustomStage,
  CustomState,
  EnumData,
  EnumValue,
  EnumValueKey,
  ExternalDomainMetadata,
  Field,
  FieldCondition,
  FieldConditionComparator,
  FieldConditionEffect,
  FieldConditions,
  FieldKey,
  FieldPrivilegeData,
  FieldReferenceData,
  FieldType,
  FloatData,
  IntData,
  PermissionData,
  RecordType,
  RecordTypeCategory,
  RecordTypeCategoryKey,
  RecordTypeKey,
  RecordTypePrivilegeData,
  RecordTypeScope,
  ReferenceData,
  ReferenceDetail,
  ReferenceType,
  SchemaVersion,
  StageDiagram,
  StageKey,
  StateKey,
  StructData,
  StructType,
  StructTypeKey,
  TargetTypeKeyData,
  TextData,
  TypedReferenceData,
} from './types/external-domain-metadata';

// ── Testing utilities (public test-support surface) ──
export type { DeepPartial } from './testing/mock-event';
export { createMockEvent } from './testing/mock-event';
export { MOCK_SERVER_DEFAULT_URL, MockServer } from './testing/mock-server';
export type {
  RequestInfo,
  RetryConfig,
  RouteConfig,
} from './testing/mock-server.interfaces';
