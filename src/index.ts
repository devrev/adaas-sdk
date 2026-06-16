// ────────────────────────────────────────────────────────────────────────────
// Public API barrel for @devrev/airsync-sdk.
//
// This is the SINGLE source of the public surface — every exported symbol is
// named explicitly (no `export *`), so any change to the public API shows up as
// a diff here. Adding a symbol to the package's public contract means adding it
// to this file.
// ────────────────────────────────────────────────────────────────────────────

// ── Entry points & adapters ──
export {
  processExtractionTask,
  processLoadingTask,
} from './multithreading/process-task';
export { spawn } from './multithreading/spawn/spawn';
export { ExtractionAdapter } from './multithreading/adapters/extraction-adapter';
export { LoadingAdapter } from './multithreading/adapters/loading-adapter';

// ── Worker contract types ──
export type {
  ProcessTaskInterface,
  TaskAdapterInterface,
  TaskResult,
  TaskStatus,
  WorkerAdapterInterface,
  WorkerAdapterOptions,
  SpawnFactoryInterface,
  SpawnInterface,
  ExtractionScope,
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
export { ErrorLevel, SyncMode } from './types/common';
export type {
  AdapterUpdateParams,
  ErrorRecord,
  InitialDomainMapping,
  LogRecord,
} from './types/common';

// ── Extraction types ──
export {
  EventType,
  ExtractionMode,
  ExtractorEventType,
  InitialSyncScope,
  TimeUnit,
  TimeValueType,
} from './types/extraction';
export type {
  AirSyncEvent,
  AirSyncMessage,
  ConnectionData,
  DomainObjectState,
  EventContext,
  EventContextIn,
  EventContextOut,
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

// ── Loading types ──
export { LoaderEventType } from './types/loading';
export type {
  ExternalSystemAttachment,
  ExternalSystemItem,
  ExternalSystemItemLoadingParams,
  ExternalSystemItemLoadingResponse,
  ItemTypeToLoad,
} from './types/loading';

// ── Repo types ──
export type {
  Item,
  NormalizedAttachment,
  NormalizedItem,
  RepoInterface,
} from './repo/repo.interfaces';

// ── Mappers ──
export { Mappers } from './mappers/mappers';
export {
  SyncMapperRecordStatus,
  SyncMapperRecordTargetType,
} from './mappers/mappers.interfaces';
export type {
  MappersCreateParams,
  MappersGetByExternalIdParams,
  MappersGetByTargetIdParams,
  MappersUpdateParams,
} from './mappers/mappers.interfaces';

// ── State types ──
export type { AdapterState } from './state/state.interfaces';

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
  StageKey,
  StageDiagram,
  StateKey,
  StructData,
  StructTypeKey,
  StructType,
  TargetTypeKeyData,
  TextData,
  TypedReferenceData,
} from './types/external-domain-metadata';

// ── Testing utilities (public test-support surface) ──
export { MockServer, MOCK_SERVER_DEFAULT_URL } from './testing/mock-server';
export type {
  RequestInfo,
  RetryConfig,
  RouteConfig,
} from './testing/mock-server.interfaces';
export { createMockEvent } from './testing/mock-event';
export type { DeepPartial } from './testing/mock-event';
