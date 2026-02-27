// Common
export {
  AdapterUpdateParams,
  ErrorLevel,
  ErrorRecord,
  InitialDomainMapping,
  LogRecord,
  SyncMode,
} from './common';

// Extraction
export {
  AirdropEvent,
  AirdropMessage,
  ConnectionData,
  DomainObjectState,
  EventContextIn,
  EventContextOut,
  EventData,
  EventType,
  ExternalProcessAttachmentFunction,
  ExternalSyncUnit,
  ExternalSystemAttachmentIteratorFunction,
  ExternalSystemAttachmentReducerFunction,
  ExternalSystemAttachmentStreamingFunction,
  ExternalSystemAttachmentStreamingParams,
  ExternalSystemAttachmentStreamingResponse,
  ExtractionMode,
  ExtractorEvent,
  ExtractorEventType,
  ProcessAttachmentReturnType,
} from './extraction';

// Loading
export {
  ExternalSystemAttachment,
  ExternalSystemItem,
  ExternalSystemItemLoadingParams,
  ExternalSystemItemLoadingResponse,
  LoaderEventType,
} from './loading';

// Repo
export {
  NormalizedAttachment,
  NormalizedItem,
  RepoInterface,
} from '../repo/repo.interfaces';

// State
export { AdapterState } from '../state/state.interfaces';

// Uploader
export {
  Artifact,
  ArtifactsPrepareResponse,
  SsorAttachment,
  StreamAttachmentsResponse,
  StreamResponse,
  UploadResponse,
} from '../uploader/uploader.interfaces';

// Mappers
export type {
  MappersCreateParams,
  MappersGetByExternalIdParams,
  MappersGetByTargetIdParams,
  MappersUpdateParams,
} from '../mappers/mappers.interface';

export {
  SyncMapperRecordStatus,
  SyncMapperRecordTargetType,
} from '../mappers/mappers.interface';

// External Domain Metadata
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
} from './external-domain-metadata';
