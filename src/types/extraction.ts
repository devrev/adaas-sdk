import { InputData } from '@devrev/typescript-sdk/dist/snap-ins';

import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { Artifact } from '../uploader/uploader.interfaces';

import { ErrorRecord } from './common';
import { DonV2, LoaderReport, RateLimited } from './loading';

/** Events sent from AirSync to the connector. */
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
}

/** Events sent from the connector to AirSync. */
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
}

/** An extractable unit in the external system (repo, project, ...). */
export interface ExternalSyncUnit {
  id: string;
  name: string;
  description: string;
  item_count?: number;
  item_type?: string;
}

export enum InitialSyncScope {
  FULL_HISTORY = 'full-history',
  TIME_SCOPED = 'time-scoped',
}

/** Duration units for time windows; matches Go's time.ParseDuration units. */
export enum TimeUnit {
  NANOSECONDS = 'ns',
  MICROSECONDS = 'us',
  MICROSECONDS_MU = 'µs',
  MILLISECONDS = 'ms',
  SECONDS = 's',
  MINUTES = 'm',
  HOURS = 'h',
}

/**
 * How the SDK resolves an extraction start/end time sent by the platform.
 * WORKERS_* variants resolve against worker state timestamps; UNBOUNDED means no bound.
 */
export enum TimeValueType {
  WORKERS_OLDEST = 'workers_oldest',
  WORKERS_OLDEST_MINUS_WINDOW = 'workers_oldest_minus_window',
  WORKERS_NEWEST = 'workers_newest',
  WORKERS_NEWEST_PLUS_WINDOW = 'workers_newest_plus_window',
  CURRENT_TIME = 'current_time',
  ABSOLUTE_TIME = 'absolute_time',
  UNBOUNDED = 'unbounded',
}

/**
 * Extraction start/end time value. `value` is an ISO 8601 timestamp for ABSOLUTE_TIME,
 * a Go duration string (e.g. '30s', '2h') for *_WINDOW types, and unused otherwise.
 */
export interface TimeValue {
  type: TimeValueType;
  value?: string;
}

export interface EventContext {
  callback_url: string;
  /** @deprecated Use dev_oid instead. */
  dev_org: string;
  dev_oid: string;
  dev_org_id: string;
  /** @deprecated Use dev_uid instead. */
  dev_user: string;
  /** @deprecated Use dev_uid instead. */
  dev_user_id: string;
  dev_uid: string;
  event_type_adaas: string;
  /** @deprecated Use external_sync_unit_id instead. */
  external_sync_unit: string;
  external_sync_unit_id: string;
  external_sync_unit_name: string;
  /** @deprecated Use external_system_id instead. */
  external_system: string;
  external_system_id: string;
  external_system_name: string;
  external_system_type: string;
  /** Start of extraction (ISO 8601), resolved by the SDK from extraction_start_time and worker state. */
  extract_from?: string;
  import_slug: string;
  initial_sync_scope?: InitialSyncScope;
  mode: string;
  request_id: string;
  request_id_adaas: string;
  /** @deprecated */
  reset_extraction?: boolean;
  /** @deprecated Use extraction_start_time/extraction_end_time (resolved into extract_from/extract_to). */
  reset_extract_from?: boolean;
  run_id: string;
  sequence_version: string;
  snap_in_slug: string;
  snap_in_version_id: string;
  /** @deprecated Use run_id instead. */
  sync_run: string;
  /** @deprecated Use run_id instead. */
  sync_run_id: string;
  sync_tier: string;
  sync_unit: DonV2;
  sync_unit_id: string;
  /** @deprecated Use request_id_adaas instead. */
  uuid: string;
  worker_data_url: string;
  /** Platform-sent start time; the SDK resolves it into extract_from. */
  extraction_start_time?: TimeValue;
  /** Platform-sent end time; the SDK resolves it into extract_to. */
  extraction_end_time?: TimeValue;
  /** End of extraction (ISO 8601), resolved by the SDK from extraction_end_time and worker state. */
  extract_to?: string;
}

export interface ConnectionData {
  org_id: string;
  org_name: string;
  key: string;
  key_type: string;
}

/** Sync-duration-estimation model input that a counted record type feeds into. */
export enum ItemInputType {
  MAIN = 'main',
  USERS = 'users',
}

/** Per-record-type count reported during the metadata phase, used for sync-duration estimation. */
export interface ItemTypeCount {
  record_type: string;
  count: number;
  model_input_type: ItemInputType;
}

export interface EventData {
  error?: ErrorRecord;
  delay?: number;
  /**
   * Artifacts produced by the worker's repos, attached to the emitted event by
   * the SDK. Includes external sync units, which are pushed to the
   * AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS repo and uploaded as artifacts.
   */
  artifacts?: Artifact[];

  // TODO: Probably this should be moved somewhere else and required in case of specific event types
  reports?: LoaderReport[];
  processed_files?: string[];
  stats_file?: string;
  /**
   * Per-record-type counts attached to the metadata-done event by the SDK when
   * the connector sets ExtractionAdapter.preExtractionItemCounts.
   */
  pre_extraction_item_counts?: ItemTypeCount[];
}

export interface WorkerMetadata {
  adaas_library_version?: string;

  // Last extracted item type statistics
  item_type?: string;
  oldest_created_date?: string;
  newest_created_date?: string;
  oldest_modified_date?: string;
  newest_modified_date?: string;

  // Absolute times from the `extract_from`/`extract_to` given to the connector.
  oldest_state_date?: string;
  newest_state_date?: string;
}

/** Event sent from AirSync to the connector. */
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

export interface AirSyncMessage {
  connection_data: ConnectionData;
  event_context: EventContext;
  event_type: EventType;
  event_data?: EventData;
}

/** Event sent from the connector to AirSync. */
export interface ExtractorEvent {
  event_type: string;
  event_context: EventContext;
  event_data?: EventData;
  worker_metadata?: WorkerMetadata;
}

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

export interface HttpStreamResponse {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  headers: Record<string, any>;
}

export interface ExternalSystemAttachmentStreamingResponse {
  httpStream?: HttpStreamResponse;
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
