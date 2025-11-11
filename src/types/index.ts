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
  EventTypeV2,
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
  ExtractorEventTypeV2,
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
