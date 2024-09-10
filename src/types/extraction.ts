import { InputData } from '@devrev/typescript-sdk/dist/snap-ins';

import { Artifact, ErrorRecord } from './common';

export enum EventType {
  // Get the list of sync units (repos, projects, ...) that can be extracted
  ExtractionExternalSyncUnitsStart = 'EXTRACTION_EXTERNAL_SYNC_UNITS_START',
  // Start the extraction of external sync unit's metadata (repos, projects, ...)
  ExtractionMetadataStart = 'EXTRACTION_METADATA_START',
  // Start the extraction of a specific external sync unit
  ExtractionDataStart = 'EXTRACTION_DATA_START',
  // Continue the extraction of a specific external sync unit
  ExtractionDataContinue = 'EXTRACTION_DATA_CONTINUE',
  // Give the external extractor an opportunity to clean up after itself
  ExtractionDataDelete = 'EXTRACTION_DATA_DELETE',
  // Extract all the attachments for a specific external sync unit
  ExtractionAttachmentsStart = 'EXTRACTION_ATTACHMENTS_START',
  // Continue the extraction of attachments for a specific external sync unit
  ExtractionAttachmentsContinue = 'EXTRACTION_ATTACHMENTS_CONTINUE',
  // Give the external extractor an opportunity to clean up after extractions of external sync units
  ExtractionAttachmentsDelete = 'EXTRACTION_ATTACHMENTS_DELETE',
}

export enum ExtractorEventType {
  /* Sync Units */
  // Sent when the extraction of external sync units finished
  ExtractionExternalSyncUnitsDone = 'EXTRACTION_EXTERNAL_SYNC_UNITS_DONE',
  // Sent when there was an unrecoverable error for extraction of external sync units.
  // Must contain a list of error records.
  ExtractionExternalSyncUnitsError = 'EXTRACTION_EXTERNAL_SYNC_UNITS_ERROR',

  /* Metadata */
  // Sent when the extraction of metadata finished
  ExtractionMetadataDone = 'EXTRACTION_METADATA_DONE',
  // Sent when there was an unrecoverable error for extraction of metadata.
  ExtractionMetadataError = 'EXTRACTION_METADATA_ERROR',

  /* Data */
  // Sent after a batch was extracted, contains artifact IDs of the uploaded files
  ExtractionDataProgress = 'EXTRACTION_DATA_PROGRESS',
  // Sent when there is a rate limit of more than ~1m, adapter will restart the extraction after the delay
  ExtractionDataDelay = 'EXTRACTION_DATA_DELAY',
  // Sent when the extraction of data finished
  ExtractionDataDone = 'EXTRACTION_DATA_DONE',
  // Sent when there was an unrecoverable error for extraction of data
  ExtractionDataError = 'EXTRACTION_DATA_ERROR',
  // Sent when the external extractor has finished cleaning up after itself
  ExtractionDataDeleteDone = 'EXTRACTION_DATA_DELETE_DONE',
  // Sent when there was an unrecoverable error for extraction of data
  ExtractionDataDeleteError = 'EXTRACTION_DATA_DELETE_ERROR',

  /* Attachments */
  // Sent after a batch was extracted, contains artifact IDs of the uploaded files
  ExtractionAttachmentsProgress = 'EXTRACTION_ATTACHMENTS_PROGRESS',
  // Sent when there is a rate limit of more than ~30s, adapter will restart the extraction after the delay
  ExtractionAttachmentsDelay = 'EXTRACTION_ATTACHMENTS_DELAY',
  // Sent when the extraction of attachements is finished
  ExtractionAttachmentsDone = 'EXTRACTION_ATTACHMENTS_DONE',
  // Sent when there was an unrecoverable error for extraction of attachments
  ExtractionAttachmentsError = 'EXTRACTION_ATTACHMENTS_ERROR',
  // Sent when the external extractor has finished cleaning up after itself
  ExtractionAttachmentsDeleteDone = 'EXTRACTION_ATTACHMENTS_DELETE_DONE',
  // Sent when there was an unrecoverable error for extraction of attachments
  ExtractionAttachmentsDeleteError = 'EXTRACTION_ATTACHMENTS_DELETE_ERROR',
}

export interface EventData {
  external_sync_units?: ExternalSyncUnit[];
  progress?: number;
  error?: ErrorRecord;
  delay?: number;
  artifacts?: Artifact[];
}

export enum ExtractionMode {
  INITIAL = 'INITIAL',
  INCREMENTAL = 'INCREMENTAL',
}

export interface ExternalSyncUnit {
  // ID of the External Sync Unit
  id: string;
  // Name of the external sync unit (usually the name of the repo or project)
  name: string;
  // Description of the external sync unit (either extracted or defined by the extractor)
  description: string;
  // Number of items in the external sync unit (if known, otherwise can be set to 0)
  item_count?: number;
}

// EventContextIn holds all the information that an external extrator needs to know about the extraction
export interface EventContextIn {
  // Mode of the extraction (INITIAL, INCREMENTAL)
  // TODO@navneel: maybe use ts-enum-util to keep this as enum
  mode: string;
  // URL of the gateway that the external extractor can use to call DevRev APIs
  callback_url: string;
  // ID of the DevOrg in which the extraction is happening
  dev_org_id: string;
  // ID of the user that started the extraction
  dev_user_id: string;
  // ID of the External Sync Unit
  external_sync_unit_id?: string;
  // ID of the Sync Unit
  sync_unit_id?: string;
  // ID of the Sync Run ID
  sync_run_id: string;
  // ID of the external system
  external_system_id: string;
  // ID of the source organization in which the extraction is happening
  uuid: string;
  // URL of the worker data endpoint
  worker_data_url: string;
}

export interface EventContextOut {
  uuid: string;
  sync_run: string;
  sync_unit?: string;
}

export interface ConnectionData {
  org_id: string;
  org_name: string;
  key: string;
  key_type: string;
}

export interface EventData {
  external_sync_units?: ExternalSyncUnit[]; // List of external sync units (repos, projects, ...) that can be extracted
  progress?: number; // Progress of the extraction in percentage (0-100)
  error?: ErrorRecord; // Error that occurred during the extraction
  delay?: number; // Delay in seconds before the extractor should be restarted
  artifacts?: Artifact[]; // List of artifacts that were uploaded to S3
}

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

export interface AirdropMessage {
  connection_data: ConnectionData;
  event_context: EventContextIn;
  event_type: EventType;
  event_data?: EventData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractor_state?: any;
}

export interface ExtractorEvent {
  event_type: string;
  event_context: EventContextOut;
  // JSON of the external extractor state, not touched by the adapter, just forwarded
  extractor_state?: string;
  // Event data
  event_data?: EventData;
}

export type AdapterState<ExtractorState> = ExtractorState & {
  lastSyncStarted?: string;
  lastSuccessfulSyncStarted?: string;
};
