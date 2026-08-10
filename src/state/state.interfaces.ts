import { InitialDomainMapping } from '../types/common';
import { AirdropEvent } from '../types/extraction';
import { FileToLoad } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

export interface SdkState {
  /**
   * @deprecated Use extract_from and extract_to from the event context instead,
   * which are automatically resolved by the SDK from extraction_start_time and extraction_end_time.
   */
  lastSyncStarted?: string;
  /**
   * @deprecated Use extract_from and extract_to from the event context instead,
   * which are automatically resolved by the SDK from extraction_start_time and extraction_end_time.
   */
  lastSuccessfulSyncStarted?: string;
  /** The pending (not yet committed) oldest extraction boundary (ISO 8601 timestamp).
   *  Set on StartExtractingMetadata, reused across subsequent phases, cleared on AttachmentExtractionDone. */
  pendingWorkersOldest?: string;
  /** The pending (not yet committed) newest extraction boundary (ISO 8601 timestamp).
   *  Set on StartExtractingMetadata, reused across subsequent phases, cleared on AttachmentExtractionDone. */
  pendingWorkersNewest?: string;
  /** The oldest point of extraction (ISO 8601 timestamp). */
  workersOldest?: string;
  /** The newest point of extraction (ISO 8601 timestamp). */
  workersNewest?: string;
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

/** Outcome of sending an attachment for processing. */
export enum ProcessedAttachmentStatus {
  Success = 'success',
  Failed = 'failed',
}

/**
 * Attachment structure, that stores both attachment id and its parent_id for deduplication
 * on the SDK side, along with whether it succeeded or failed.
 */
export interface ProcessedAttachment {
  id: string;
  parent_id: string;
  status: ProcessedAttachmentStatus;
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
  pendingWorkersOldest: '',
  pendingWorkersNewest: '',
  workersOldest: '',
  workersNewest: '',
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
