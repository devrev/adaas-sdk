import { InputData } from '@devrev/typescript-sdk/dist/snap-ins';

import { Artifact } from '../uploader/uploader.interfaces';

import { ErrorRecord } from './common';

import { DonV2, LoaderReport, RateLimited } from './loading';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { AxiosResponse } from 'axios';
import { WorkerAdapter } from '../workers/worker-adapter';

/**
 * EventType is an enum that defines the different types of events that can be sent to the external extractor from ADaaS.
 * The external extractor can use these events to know what to do next in the extraction process.
 */
export enum EventType {
  // Extraction
  ExtractionExternalSyncUnitsStart = 'EXTRACTION_EXTERNAL_SYNC_UNITS_START',
  ExtractionMetadataStart = 'EXTRACTION_METADATA_START',
  ExtractionDataStart = 'EXTRACTION_DATA_START',
  ExtractionDataContinue = 'EXTRACTION_DATA_CONTINUE',
  ExtractionDataDelete = 'EXTRACTION_DATA_DELETE',
  ExtractionAttachmentsStart = 'EXTRACTION_ATTACHMENTS_START',
  ExtractionAttachmentsContinue = 'EXTRACTION_ATTACHMENTS_CONTINUE',
  ExtractionAttachmentsDelete = 'EXTRACTION_ATTACHMENTS_DELETE',

  // Loading
  StartLoadingData = 'START_LOADING_DATA',
  ContinueLoadingData = 'CONTINUE_LOADING_DATA',
  StartLoadingAttachments = 'START_LOADING_ATTACHMENTS',
  ContinueLoadingAttachments = 'CONTINUE_LOADING_ATTACHMENTS',
  StartDeletingLoaderState = 'START_DELETING_LOADER_STATE',
  StartDeletingLoaderAttachmentState = 'START_DELETING_LOADER_ATTACHMENT_STATE',
}

/**
 * ExtractorEventType is an enum that defines the different types of events that can be sent from the external extractor to ADaaS.
 * The external extractor can use these events to inform ADaaS about the progress of the extraction process.
 */
export enum ExtractorEventType {
  // Extraction
  ExtractionExternalSyncUnitsDone = 'EXTRACTION_EXTERNAL_SYNC_UNITS_DONE',
  ExtractionExternalSyncUnitsError = 'EXTRACTION_EXTERNAL_SYNC_UNITS_ERROR',
  ExtractionMetadataDone = 'EXTRACTION_METADATA_DONE',
  ExtractionMetadataError = 'EXTRACTION_METADATA_ERROR',
  ExtractionDataProgress = 'EXTRACTION_DATA_PROGRESS',
  ExtractionDataDelay = 'EXTRACTION_DATA_DELAY',
  ExtractionDataDone = 'EXTRACTION_DATA_DONE',
  ExtractionDataError = 'EXTRACTION_DATA_ERROR',
  ExtractionDataDeleteDone = 'EXTRACTION_DATA_DELETE_DONE',
  ExtractionDataDeleteError = 'EXTRACTION_DATA_DELETE_ERROR',
  ExtractionAttachmentsProgress = 'EXTRACTION_ATTACHMENTS_PROGRESS',
  ExtractionAttachmentsDelay = 'EXTRACTION_ATTACHMENTS_DELAY',
  ExtractionAttachmentsDone = 'EXTRACTION_ATTACHMENTS_DONE',
  ExtractionAttachmentsError = 'EXTRACTION_ATTACHMENTS_ERROR',
  ExtractionAttachmentsDeleteDone = 'EXTRACTION_ATTACHMENTS_DELETE_DONE',
  ExtractionAttachmentsDeleteError = 'EXTRACTION_ATTACHMENTS_DELETE_ERROR',

  // Unknown
  UnknownEventType = 'UNKNOWN_EVENT_TYPE',
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
 * ExtractionMode is an enum that defines the different modes of extraction that can be used by the external extractor.
 * It can be either INITIAL or INCREMENTAL. INITIAL mode is used for the first/initial import, while INCREMENTAL mode is used for doing syncs.
 */
export enum SyncMode {
  INITIAL = 'INITIAL',
  INCREMENTAL = 'INCREMENTAL',
  LOADING = 'LOADING',
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
 * EventContext is an interface that defines the structure of the event context that is sent to and from the external connector.
 */
export interface EventContext {
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
  snap_in_version_id: string;
  sync_run: string;
  sync_run_id: string;
  sync_tier: string;
  sync_unit: DonV2;
  sync_unit_id: string;
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
  ConnectorState,
> = ({
  attachments,
  adapter,
}: {
  attachments: Batch;
  adapter: WorkerAdapter<ConnectorState>;
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
  NewBatch,
> {
  reducer: ExternalSystemAttachmentReducerFunction<
    Batch,
    NewBatch,
    ConnectorState
  >;
  iterator: ExternalSystemAttachmentIteratorFunction<NewBatch, ConnectorState>;
}
