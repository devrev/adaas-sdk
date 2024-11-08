import { InputData } from '@devrev/typescript-sdk/dist/snap-ins';

import { Artifact } from '../uploader/uploader.interfaces';

import { ErrorRecord } from './common';

/**
 * EventType is an enum that defines the different types of events that can be sent to the external extractor from ADaaS.
 * The external extractor can use these events to know what to do next in the extraction process.
 */
export enum EventType {
  ExtractionExternalSyncUnitsStart = 'EXTRACTION_EXTERNAL_SYNC_UNITS_START',
  ExtractionMetadataStart = 'EXTRACTION_METADATA_START',
  ExtractionDataStart = 'EXTRACTION_DATA_START',
  ExtractionDataContinue = 'EXTRACTION_DATA_CONTINUE',
  ExtractionDataDelete = 'EXTRACTION_DATA_DELETE',
  ExtractionAttachmentsStart = 'EXTRACTION_ATTACHMENTS_START',
  ExtractionAttachmentsContinue = 'EXTRACTION_ATTACHMENTS_CONTINUE',
  ExtractionAttachmentsDelete = 'EXTRACTION_ATTACHMENTS_DELETE',
}

/**
 * ExtractorEventType is an enum that defines the different types of events that can be sent from the external extractor to ADaaS.
 * The external extractor can use these events to inform ADaaS about the progress of the extraction process.
 */
export enum ExtractorEventType {
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
}

/**
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
 * EventContextIn is an interface that defines the structure of the input event context that is sent to the external extractor from ADaaS.
 */
export interface EventContextIn {
  mode: string;
  callback_url: string;
  dev_org_id: string;
  dev_user_id: string;
  external_sync_unit_id?: string;
  sync_unit_id?: string;
  sync_run_id: string;
  external_system_id: string;
  uuid: string;
  worker_data_url: string;
  external_system: string;
  external_system_type: string;
  import_slug: string;
  snap_in_slug: string;
  sync_tier: string;
}

/**
 * EventContextOut is an interface that defines the structure of the output event context that is sent from the external extractor to ADaaS.
 */
export interface EventContextOut {
  uuid: string;
  sync_run: string;
  sync_unit?: string;
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
  event_context: EventContextIn;
  event_type: EventType;
  event_data?: EventData;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extractor_state?: any;
}

/**
 * ExtractorEvent is an interface that defines the structure of the event that is sent from the external extractor to ADaaS.
 * It contains the event type, event context, extractor state, and event data.
 */
export interface ExtractorEvent {
  event_type: string;
  event_context: EventContextOut;
  extractor_state?: string;
  event_data?: EventData;
}
