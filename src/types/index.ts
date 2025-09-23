// Common
export {
  ErrorLevel,
  ErrorRecord,
  LogRecord,
  AdapterUpdateParams,
  InitialDomainMapping,
  SyncMode,
} from './common';

// Extraction
export {
  EventType,
  ExtractorEventType,
  ExtractionMode,
  ExternalSyncUnit,
  EventContextIn,
  EventContextOut,
  ConnectionData,
  EventData,
  DomainObjectState,
  AirdropEvent,
  AirdropMessage,
  ExtractorEvent,
  ExternalSystemAttachmentStreamingParams,
  ExternalSystemAttachmentStreamingResponse,
  ExternalSystemAttachmentStreamingFunction,
  ExternalProcessAttachmentFunction,
  ExternalSystemAttachmentReducerFunction,
  ExternalSystemAttachmentIteratorFunction,
  ProcessAttachmentReturnType,
} from './extraction';

// Loading
export {
  LoaderEventType,
  ExternalSystemItem,
  ExternalSystemItemLoadingResponse,
  ExternalSystemItemLoadingParams,
  ExternalSystemAttachment,
} from './loading';

// Repo
export {
  NormalizedItem,
  NormalizedAttachment,
  RepoInterface,
} from '../repo/repo.interfaces';

// State
export { AdapterState } from '../state/state.interfaces';

// Uploader
export {
  Artifact,
  ArtifactsPrepareResponse,
  UploadResponse,
  StreamResponse,
  StreamAttachmentsResponse,
  SsorAttachment,
} from '../uploader/uploader.interfaces';

// Mappers
export type {
  MappersGetByTargetIdParams,
  MappersGetByExternalIdParams,
  MappersCreateParams,
  MappersUpdateParams,
} from '../mappers/mappers.interface';

export {
  SyncMapperRecordStatus,
  SyncMapperRecordTargetType,
} from '../mappers/mappers.interface';
