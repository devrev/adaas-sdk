import { InitialDomainMapping } from '../types/common';
import { AirdropEvent, ExtractionTimeDirection } from '../types/extraction';
import { FileToLoad } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

export interface SdkState {
  lastSyncStarted?: string;
  lastSuccessfulSyncStarted?: string;
  /** The oldest point of extraction (ISO 8601 timestamp). */
  workers_oldest?: string;
  /** The newest point of extraction (ISO 8601 timestamp). */
  workers_newest?: string;
  /** The direction of extraction stored from the event context. */
  extraction_time_direction?: ExtractionTimeDirection;
  toDevRev?: ToDevRev;
  fromDevRev?: FromDevRev;
  snapInVersionId?: string;
}

/**
 * AdapterState is an interface that defines the structure of the adapter state that is used by the external extractor.
 * It extends the connector state with additional fields: lastSyncStarted, lastSuccessfulSyncStarted, snapInVersionId and attachmentsMetadata.
 */
export type AdapterState<ConnectorState> = ConnectorState & SdkState;

export interface ToDevRev {
  attachmentsMetadata: {
    artifactIds: string[];
    lastProcessed: number;
    lastProcessedAttachmentsIdsList?: ProcessedAttachment[];
  };
}

/**
 * Attachment structure, that stores both attachment id and its parent_id for deduplication on the SDK side.
 */
export interface ProcessedAttachment {
  id: string;
  parent_id: string;
}

export interface FromDevRev {
  filesToLoad: FileToLoad[];
}

export interface StateInterface<ConnectorState> {
  event: AirdropEvent;
  initialState: ConnectorState;
  initialDomainMapping?: InitialDomainMapping;
  options?: WorkerAdapterOptions;
}

export const extractionSdkState = {
  lastSyncStarted: '',
  lastSuccessfulSyncStarted: '',
  workers_oldest: '',
  workers_newest: '',
  extraction_time_direction: undefined,
  snapInVersionId: '',
  toDevRev: {
    attachmentsMetadata: {
      artifactIds: [],
      lastProcessed: 0,
      lastProcessedAttachmentsIdsList: [],
    },
  },
};

export const loadingSdkState = {
  snapInVersionId: '',
  fromDevRev: {
    filesToLoad: [],
  },
};
