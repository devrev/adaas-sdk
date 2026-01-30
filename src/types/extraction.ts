import { InputData } from '@devrev/typescript-sdk/dist/snap-ins';

import { Artifact } from '../uploader/uploader.interfaces';

import { ErrorRecord } from './common';

import { AxiosResponse } from 'axios';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { WorkerAdapter } from '../multithreading/worker-adapter/worker-adapter';
import { DonV2, LoaderReport, RateLimited } from './loading';

/**
 * EventType is an enum that defines the different types of events that can be sent to the external extractor from ADaaS.
 * The external extractor can use these events to know what to do next in the extraction process.
 */
export enum EventType {
  // Extraction - Old member names with OLD values (deprecated, kept for backwards compatibility)
  /**
   * @deprecated Use StartExtractingExternalSyncUnits instead
   */
  ExtractionExternalSyncUnitsStart = 'EXTRACTION_EXTERNAL_SYNC_UNITS_START',
  /**
   * @deprecated Use StartExtractingMetadata instead
   */
  ExtractionMetadataStart = 'EXTRACTION_METADATA_START',
  /**
   * @deprecated Use StartExtractingData instead
   */
  ExtractionDataStart = 'EXTRACTION_DATA_START',
  /**
   * @deprecated Use ContinueExtractingData instead
   */
  ExtractionDataContinue = 'EXTRACTION_DATA_CONTINUE',
  /**
   * @deprecated Use StartDeletingExtractorState instead
   */
  ExtractionDataDelete = 'EXTRACTION_DATA_DELETE',
  /**
   * @deprecated Use StartExtractingAttachments instead
   */
  ExtractionAttachmentsStart = 'EXTRACTION_ATTACHMENTS_START',
  /**
   * @deprecated Use ContinueExtractingAttachments instead
   */
  ExtractionAttachmentsContinue = 'EXTRACTION_ATTACHMENTS_CONTINUE',
  /**
   * @deprecated Use StartDeletingExtractorAttachmentsState instead
   */
  ExtractionAttachmentsDelete = 'EXTRACTION_ATTACHMENTS_DELETE',

  // Loading
  StartLoadingData = 'START_LOADING_DATA',
  ContinueLoadingData = 'CONTINUE_LOADING_DATA',
  StartLoadingAttachments = 'START_LOADING_ATTACHMENTS',
  ContinueLoadingAttachments = 'CONTINUE_LOADING_ATTACHMENTS',
  StartDeletingLoaderState = 'START_DELETING_LOADER_STATE',
  StartDeletingLoaderAttachmentState = 'START_DELETING_LOADER_ATTACHMENT_STATE',

  // Unknown
  UnknownEventType = 'UNKNOWN_EVENT_TYPE',

  // Extraction - New member names with NEW values (preferred)
  StartExtractingExternalSyncUnits = 'START_EXTRACTING_EXTERNAL_SYNC_UNITS',
  StartExtractingMetadata = 'START_EXTRACTING_METADATA',
  StartExtractingData = 'START_EXTRACTING_DATA',
  ContinueExtractingData = 'CONTINUE_EXTRACTING_DATA',
  StartDeletingExtractorState = 'START_DELETING_EXTRACTOR_STATE',
  StartExtractingAttachments = 'START_EXTRACTING_ATTACHMENTS',
  ContinueExtractingAttachments = 'CONTINUE_EXTRACTING_ATTACHMENTS',
  StartDeletingExtractorAttachmentsState = 'START_DELETING_EXTRACTOR_ATTACHMENTS_STATE',
}

/**
 * ExtractorEventType is an enum that defines the different types of events that can be sent from the external extractor to ADaaS.
 * The external extractor can use these events to inform ADaaS about the progress of the extraction process.
 */
export enum ExtractorEventType {
  // Extraction - Old member names with OLD values (deprecated, kept for backwards compatibility)
  /**
   * @deprecated Use ExternalSyncUnitExtractionDone instead
   */
  ExtractionExternalSyncUnitsDone = 'EXTRACTION_EXTERNAL_SYNC_UNITS_DONE',
  /**
   * @deprecated Use ExternalSyncUnitExtractionError instead
   */
  ExtractionExternalSyncUnitsError = 'EXTRACTION_EXTERNAL_SYNC_UNITS_ERROR',
  /**
   * @deprecated Use MetadataExtractionDone instead
   */
  ExtractionMetadataDone = 'EXTRACTION_METADATA_DONE',
  /**
   * @deprecated Use MetadataExtractionError instead
   */
  ExtractionMetadataError = 'EXTRACTION_METADATA_ERROR',
  /**
   * @deprecated Use DataExtractionProgress instead
   */
  ExtractionDataProgress = 'EXTRACTION_DATA_PROGRESS',
  /**
   * @deprecated Use DataExtractionDelayed instead
   */
  ExtractionDataDelay = 'EXTRACTION_DATA_DELAY',
  /**
   * @deprecated Use DataExtractionDone instead
   */
  ExtractionDataDone = 'EXTRACTION_DATA_DONE',
  /**
   * @deprecated Use DataExtractionError instead
   */
  ExtractionDataError = 'EXTRACTION_DATA_ERROR',
  /**
   * @deprecated Use ExtractorStateDeletionDone instead
   */
  ExtractionDataDeleteDone = 'EXTRACTION_DATA_DELETE_DONE',
  /**
   * @deprecated Use ExtractorStateDeletionError instead
   */
  ExtractionDataDeleteError = 'EXTRACTION_DATA_DELETE_ERROR',
  /**
   * @deprecated Use AttachmentExtractionProgress instead
   */
  ExtractionAttachmentsProgress = 'EXTRACTION_ATTACHMENTS_PROGRESS',
  /**
   * @deprecated Use AttachmentExtractionDelayed instead
   */
  ExtractionAttachmentsDelay = 'EXTRACTION_ATTACHMENTS_DELAY',
  /**
   * @deprecated Use AttachmentExtractionDone instead
   */
  ExtractionAttachmentsDone = 'EXTRACTION_ATTACHMENTS_DONE',
  /**
   * @deprecated Use AttachmentExtractionError instead
   */
  ExtractionAttachmentsError = 'EXTRACTION_ATTACHMENTS_ERROR',
  /**
   * @deprecated Use ExtractorAttachmentsStateDeletionDone instead
   */
  ExtractionAttachmentsDeleteDone = 'EXTRACTION_ATTACHMENTS_DELETE_DONE',
  /**
   * @deprecated Use ExtractorAttachmentsStateDeletionError instead
   */
  ExtractionAttachmentsDeleteError = 'EXTRACTION_ATTACHMENTS_DELETE_ERROR',

  // Unknown
  UnknownEventType = 'UNKNOWN_EVENT_TYPE',

  // Extraction - New member names with NEW values (preferred)
  ExternalSyncUnitExtractionDone = 'EXTERNAL_SYNC_UNIT_EXTRACTION_DONE',
  ExternalSyncUnitExtractionError = 'EXTERNAL_SYNC_UNIT_EXTRACTION_ERROR',
  MetadataExtractionDone = 'METADATA_EXTRACTION_DONE',
  MetadataExtractionError = 'METADATA_EXTRACTION_ERROR',
  DataExtractionProgress = 'DATA_EXTRACTION_PROGRESS',
  DataExtractionDelayed = 'DATA_EXTRACTION_DELAYED',
  DataExtractionDone = 'DATA_EXTRACTION_DONE',
  DataExtractionError = 'DATA_EXTRACTION_ERROR',
  ExtractorStateDeletionDone = 'EXTRACTOR_STATE_DELETION_DONE',
  ExtractorStateDeletionError = 'EXTRACTOR_STATE_DELETION_ERROR',
  AttachmentExtractionProgress = 'ATTACHMENT_EXTRACTION_PROGRESS',
  AttachmentExtractionDelayed = 'ATTACHMENT_EXTRACTION_DELAYED',
  AttachmentExtractionDone = 'ATTACHMENT_EXTRACTION_DONE',
  AttachmentExtractionError = 'ATTACHMENT_EXTRACTION_ERROR',
  ExtractorAttachmentsStateDeletionDone = 'EXTRACTOR_ATTACHMENTS_STATE_DELETION_DONE',
  ExtractorAttachmentsStateDeletionError = 'EXTRACTOR_ATTACHMENTS_STATE_DELETION_ERROR',
}

/**
 * @deprecated
 * ExtractionMode is an enum that defines the different modes of extraction that can be used by the external extractor.
 * It can be either INITIAL or INCREMENTAL. INITIAL mode is used for the first/initial import, while INCREMENTAL mode is used for doing syncs.
 */
export enum ExtractionMode {
  INITIAL = 'INITIAL',
  INCREMENTAL = 'INCREMENTAL',
}

/**
 * ExternalSyncUnit is an interface that defines the structure of an external sync unit (repos, projects, ...) that can be extracted.
 * It must contain an ID, a name, and a description. It can also contain the number of items in the external sync unit.
 */
export interface ExternalSyncUnit {
  id: string;
  name: string;
  description: string;
  item_count?: number;
  item_type?: string;
}

/**
 * InitialSyncScope is an enum that defines the different scopes of initial sync that can be used by the external extractor.
 */
export enum InitialSyncScope {
  FULL_HISTORY = 'full-history',
  TIME_SCOPED = 'time-scoped',
}

/**
 * EventContextIn is an interface that defines the structure of the input event context that is sent to the external extractor from ADaaS.
 * @deprecated
 */
export interface EventContextIn {
  callback_url: string;
  dev_org: string;
  dev_org_id: string;
  dev_user: string;
  dev_user_id: string;
  external_sync_unit: string;
  external_sync_unit_id: string;
  external_sync_unit_name: string;
  external_system: string;
  external_system_type: string;
  import_slug: string;
  mode: string;
  request_id: string;
  snap_in_slug: string;
  sync_run: string;
  sync_run_id: string;
  sync_tier: string;
  sync_unit: DonV2;
  sync_unit_id: string;
  uuid: string;
  worker_data_url: string;
}

/**
 * EventContextOut is an interface that defines the structure of the output event context that is sent from the external extractor to ADaaS.
 * @deprecated
 */
export interface EventContextOut {
  uuid: string;
  sync_run: string;
  sync_unit?: string;
}

/**
 * EventContext is an interface that defines the structure of the event context that is sent to the external connector from Airdrop.
 */
export interface EventContext {
  callback_url: string;
  /**
   * @deprecated dev_org is deprecated and should not be used. Use dev_oid instead.
   */
  dev_org: string;
  dev_oid: string;
  dev_org_id: string;
  /**
   * @deprecated dev_user is deprecated and should not be used. Use dev_uid instead.
   */
  dev_user: string;
  /**
   * @deprecated dev_user_id is deprecated and should not be used. Use dev_uid instead.
   */
  dev_user_id: string;
  dev_uid: string;
  event_type_adaas: string;
  /**
   * @deprecated external_sync_unit is deprecated and should not be used. Use external_sync_unit_id instead.
   */
  external_sync_unit: string;
  external_sync_unit_id: string;
  external_sync_unit_name: string;
  /**
   * @deprecated external_system is deprecated and should not be used. Use external_system_id instead.
   */
  external_system: string;
  external_system_id: string;
  external_system_name: string;
  external_system_type: string;
  extract_from?: string;
  import_slug: string;
  initial_sync_scope?: InitialSyncScope;
  mode: string;
  request_id: string;
  request_id_adaas: string;
  /**
   * @deprecated reset_extraction is deprecated and should not be used. Use reset_extract_from instead.
   */
  reset_extraction?: boolean;
  reset_extract_from?: boolean;
  run_id: string;
  sequence_version: string;
  snap_in_slug: string;
  snap_in_version_id: string;
  /**
   * @deprecated sync_run is deprecated and should not be used. Use run_id instead.
   */
  sync_run: string;
  /**
   * @deprecated sync_run_id is deprecated and should not be used. Use run_id instead.
   */
  sync_run_id: string;
  sync_tier: string;
  sync_unit: DonV2;
  sync_unit_id: string;
  /**
   * @deprecated uuid is deprecated and should not be used. Use request_id_adaas instead.
   */
  uuid: string;
  worker_data_url: string;
}

/**
 * ConnectionData is an interface that defines the structure of the connection data that is sent to the external extractor from ADaaS.
 * It contains the organization ID, organization name, key, and key type.
 */
export interface ConnectionData {
  org_id: string;
  org_name: string;
  key: string;
  key_type: string;
}

/**
 * EventData is an interface that defines the structure of the event data that is sent from the external extractor to ADaaS.
 */
export interface EventData {
  external_sync_units?: ExternalSyncUnit[];
  /**
   * @deprecated This field is deprecated and should not be used. Progress is
   * now calculated on the backend.
   */
  progress?: number;
  error?: ErrorRecord;
  delay?: number;
  /**
   * @deprecated This field is deprecated and should not be used.
   */
  artifacts?: Artifact[];

  // TODO: Probably this should be moved somewhere else and required in case of specific event types
  reports?: LoaderReport[];
  processed_files?: string[];
  stats_file?: string;
}

/**
 * WorkerMetadata is an interface that defines the structure of the worker metadata that is sent from the external extractor to ADaaS.
 */
export interface WorkerMetadata {
  adaas_library_version: string;
}

/**
 * DomainObject is an interface that defines the structure of a domain object that can be extracted.
 * It must contain a name, a next chunk ID, the pages, the last modified date, whether it is done, and the count.
 * @deprecated
 */
export interface DomainObjectState {
  name: string;
  nextChunkId: number;
  pages?: {
    pages: number[];
  };
  lastModified: string;
  isDone: boolean;
  count: number;
}

/**
 * AirdropEvent is an interface that defines the structure of the event that is sent to the external extractor from ADaaS.
 * It contains the context, payload, execution metadata, and input data as common snap-ins.
 */
export interface AirdropEvent {
  context: {
    secrets: {
      service_account_token: string;
    };
    snap_in_version_id: string;
    snap_in_id: string;
  };
  payload: AirdropMessage;
  execution_metadata: {
    devrev_endpoint: string;
  };
  input_data: InputData;
}

/**
 * AirdropMessage is an interface that defines the structure of the payload/message that is sent to the external extractor from ADaaS.
 */
export interface AirdropMessage {
  connection_data: ConnectionData;
  event_context: EventContext;
  event_type: EventType;
  event_data?: EventData;
}

/**
 * ExtractorEvent is an interface that defines the structure of the event that is sent from the external extractor to ADaaS.
 * It contains the event type, event context, extractor state, and event data.
 */
export interface ExtractorEvent {
  event_type: string;
  event_context: EventContext;
  event_data?: EventData;
  worker_metadata?: WorkerMetadata;
}

/**
 * LoaderEvent
 */
export interface LoaderEvent {
  event_type: string;
  event_context: EventContext;
  event_data?: EventData;
  worker_metadata?: WorkerMetadata;
}

export type ExternalSystemAttachmentStreamingFunction = ({
  item,
  event,
}: ExternalSystemAttachmentStreamingParams) => Promise<ExternalSystemAttachmentStreamingResponse>;

export interface ExternalSystemAttachmentStreamingParams {
  item: NormalizedAttachment;
  event: AirdropEvent;
}

export interface ExternalSystemAttachmentStreamingResponse {
  httpStream?: AxiosResponse;
  error?: ErrorRecord;
  delay?: number;
}

export interface StreamAttachmentsResponse {
  error?: ErrorRecord;
  report?: LoaderReport;
  rateLimit?: RateLimited;
}

export type ProcessAttachmentReturnType =
  | {
      delay?: number;
      error?: { message: string };
    }
  | undefined;

export type StreamAttachmentsReturnType =
  | {
      delay?: number;
      error?: ErrorRecord;
    }
  | undefined;

export type ExternalSystemAttachmentReducerFunction<
  Batch,
  NewBatch,
  ConnectorState
> = ({
  attachments,
  adapter,
  batchSize,
}: {
  attachments: Batch;
  adapter: WorkerAdapter<ConnectorState>;
  batchSize?: number;
}) => NewBatch;

export type ExternalProcessAttachmentFunction = ({
  attachment,
  stream,
}: {
  attachment: NormalizedAttachment;
  stream: ExternalSystemAttachmentStreamingFunction;
}) => Promise<ProcessAttachmentReturnType>;

export type ExternalSystemAttachmentIteratorFunction<NewBatch, ConnectorState> =
  ({
    reducedAttachments,
    adapter,
    stream,
  }: {
    reducedAttachments: NewBatch;
    adapter: WorkerAdapter<ConnectorState>;
    stream: ExternalSystemAttachmentStreamingFunction;
  }) => Promise<ProcessAttachmentReturnType>;

export interface ExternalSystemAttachmentProcessors<
  ConnectorState,
  Batch,
  NewBatch
> {
  reducer: ExternalSystemAttachmentReducerFunction<
    Batch,
    NewBatch,
    ConnectorState
  >;
  iterator: ExternalSystemAttachmentIteratorFunction<NewBatch, ConnectorState>;
}
