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
  ExternalDomainMetadata,
  ExtractionData,
  ExtractionSortOrder,
  Field,
  FieldCondition,
  FieldConditionComparator,
  FieldConditionEffect,
  FieldConditions,
  FieldPrivilegeData,
  FieldReferenceData,
  FieldType,
  FloatData,
  IntData,
  LoadingData,
  PermissionData,
  RecordType,
  RecordTypeCategory,
  RecordTypePrivilegeData,
  RecordTypeScope,
  ReferenceData,
  ReferenceDetail,
  ReferenceType,
  SchemaVersion,
  StageDiagram,
  StructData,
  StructType,
  TargetTypeKeyData,
  TextData,
  TypedReferenceData,
} from './external-domain-metadata';
