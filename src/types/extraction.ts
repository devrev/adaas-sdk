import { InputData } from '@devrev/typescript-sdk/dist/snap-ins';

import { Artifact } from '../uploader/uploader.interfaces';

import { ErrorRecord } from './common';

import { AxiosResponse } from 'axios';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';
import { DonV2, LoaderReport, RateLimited } from './loading';

/**
 * EventType is an enum that defines the different types of events that can be sent to the external extractor from AirSync.
 * The external extractor can use these events to know what to do next in the extraction process.
 */
export enum EventType {
  // Extraction
  StartExtractingExternalSyncUnits = 'START_EXTRACTING_EXTERNAL_SYNC_UNITS',
  StartExtractingMetadata = 'START_EXTRACTING_METADATA',
  StartExtractingData = 'START_EXTRACTING_DATA',
  ContinueExtractingData = 'CONTINUE_EXTRACTING_DATA',
  StartDeletingExtractorState = 'START_DELETING_EXTRACTOR_STATE',
  StartExtractingAttachments = 'START_EXTRACTING_ATTACHMENTS',
  ContinueExtractingAttachments = 'CONTINUE_EXTRACTING_ATTACHMENTS',
  StartDeletingExtractorAttachmentsState = 'START_DELETING_EXTRACTOR_ATTACHMENTS_STATE',

  // Loading
  StartLoadingData = 'START_LOADING_DATA',
  ContinueLoadingData = 'CONTINUE_LOADING_DATA',
  StartLoadingAttachments = 'START_LOADING_ATTACHMENTS',
  ContinueLoadingAttachments = 'CONTINUE_LOADING_ATTACHMENTS',
  StartDeletingLoaderState = 'START_DELETING_LOADER_STATE',
  StartDeletingLoaderAttachmentState = 'START_DELETING_LOADER_ATTACHMENT_STATE',

  // Unknown
  UnknownEventType = 'UNKNOWN_EVENT_TYPE',
}

/**
 * ExtractorEventType is an enum that defines the different types of events that can be sent from the external extractor to AirSync.
 * The external extractor can use these events to inform AirSync about the progress of the extraction process.
 */
export enum ExtractorEventType {
  // Extraction
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
 * TimeUnit is an enum that defines the supported Go duration units for time window calculations.
 * These correspond directly to Go's time.ParseDuration units.
 */
export enum TimeUnit {
  /** Nanoseconds */
  NANOSECONDS = 'ns',
  /** Microseconds (ASCII alias) */
  MICROSECONDS = 'us',
  /** Microseconds (Unicode alias) */
  MICROSECONDS_MU = 'µs',
  /** Milliseconds */
  MILLISECONDS = 'ms',
  /** Seconds */
  SECONDS = 's',
  /** Minutes */
  MINUTES = 'm',
  /** Hours */
  HOURS = 'h',
}

/**
 * TimeValueType is an enum that defines the type of a time value used in extraction start/end times.
 * The platform sends these types to indicate how the extraction time should be resolved by the SDK.
 */
export enum TimeValueType {
  /** Oldest timestamp from worker state */
  WORKERS_OLDEST = 'workers_oldest',
  /** Oldest timestamp from worker state minus a duration window */
  WORKERS_OLDEST_MINUS_WINDOW = 'workers_oldest_minus_window',
  /** Newest timestamp from worker state */
  WORKERS_NEWEST = 'workers_newest',
  /** Newest timestamp from worker state plus a duration window */
  WORKERS_NEWEST_PLUS_WINDOW = 'workers_newest_plus_window',
  /** Current time */
  CURRENT_TIME = 'current_time',
  /** User-specified absolute timestamp */
  ABSOLUTE_TIME = 'absolute_time',
  /** No bound - extract all available data */
  UNBOUNDED = 'unbounded',
}

/**
 * TimeValue is an interface that represents a time value used in extraction start/end times.
 * It contains a type (which denotes how the value should be resolved) and an optional value.
 * - For ABSOLUTE: value is an ISO 8601 timestamp
 * - For *_WINDOW types: value is a Go duration string (e.g. '500ms', '30s', '5m', '2h')
 * - For other types: value is not used
 */
export interface TimeValue {
  type: TimeValueType;
  value?: string;
}

/**
 * EventContextIn is an interface that defines the structure of the input event context that is sent to the external extractor from AirSync.
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
 * EventContextOut is an interface that defines the structure of the output event context that is sent from the external extractor to AirSync.
 * @deprecated
 */
export interface EventContextOut {
  uuid: string;
  sync_run: string;
  sync_unit?: string;
}

/**
 * EventContext is an interface that defines the structure of the event context that is sent to the external connector from AirSync.
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
  /**
   * Resolved start timestamp of extraction (ISO 8601 format).
   * Automatically computed by the SDK from extraction_start_time and worker state.
   * This is the field developers should read to know when to start extracting from.
   */
  extract_from?: string;
  import_slug: string;
  initial_sync_scope?: InitialSyncScope;
  mode: string;
  request_id: string;
  request_id_adaas: string;
  /**
   * @deprecated reset_extraction is deprecated and should not be used.
   */
  reset_extraction?: boolean;
  /**
   * @deprecated reset_extract_from is deprecated. Use extraction_start_time/extraction_end_time instead,
   * which are automatically resolved into extract_from and extract_to.
   */
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
  /**
   * Start time value for extraction, as sent by the platform.
   * The SDK resolves this into a concrete ISO 8601 timestamp on extract_from.
   */
  extraction_start_time?: TimeValue;
  /**
   * End time value for extraction, as sent by the platform.
   * The SDK resolves this into a concrete ISO 8601 timestamp on extract_to.
   */
  extraction_end_time?: TimeValue;
  /**
   * Resolved end timestamp of extraction (ISO 8601 format).
   * Automatically computed by the SDK from extraction_end_time and worker state.
   * This is the field developers should read to know when to stop extracting at.
   */
  extract_to?: string;
}

/**
 * ConnectionData is an interface that defines the structure of the connection data that is sent to the external extractor from AirSync.
 * It contains the organization ID, organization name, key, and key type.
 */
export interface ConnectionData {
  org_id: string;
  org_name: string;
  key: string;
  key_type: string;
}

/**
 * EventData is an interface that defines the structure of the event data that is sent from the external extractor to AirSync.
 */
export interface EventData {
  /**
   * @deprecated This field is deprecated and should not be used. External sync units should be pushed to the AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS repo.
   *
   */
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
 * WorkerMetadata is an interface that defines the structure of the worker metadata that is sent from the external extractor to AirSync.
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
 * AirSyncEvent is an interface that defines the structure of the event that is sent to the external extractor from AirSync.
 * It contains the context, payload, execution metadata, and input data as common snap-ins.
 */
export interface AirSyncEvent {
  context: {
    secrets: {
      service_account_token: string;
    };
    snap_in_version_id: string;
    snap_in_id: string;
    /** DevRev identity of the user who triggered the sync. */
    user_id: string;
    /** DevRev org id (don:identity:.../devo/...). */
    dev_oid: string;
    /** External source identity, when the platform provides one. */
    source_id: string;
    /** DevRev service-account identity used for the sync. */
    service_account_id: string;
  };
  payload: AirSyncMessage;
  execution_metadata: {
    devrev_endpoint: string;
  };
  input_data: InputData;
}

/**
 * AirSyncMessage is an interface that defines the structure of the payload/message that is sent to the external extractor from AirSync.
 */
export interface AirSyncMessage {
  connection_data: ConnectionData;
  event_context: EventContext;
  event_type: EventType;
  event_data?: EventData;
}

/**
 * ExtractorEvent is an interface that defines the structure of the event that is sent from the external extractor to AirSync.
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
  event: AirSyncEvent;
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
      error?: { message: string; fileSize?: number };
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
  adapter: ExtractionAdapter<ConnectorState>;
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
    adapter: ExtractionAdapter<ConnectorState>;
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
