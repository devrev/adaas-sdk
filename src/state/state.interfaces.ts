import { InitialDomainMapping } from '../types/common';
import { AirdropEvent } from '../types/extraction';
import { FileToLoad } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * Sentinel value representing an unbounded (no limit) extraction timestamp.
 * Used as the resolved value for TimeValueType.UNBOUNDED, stored as workers_oldest
 * when the initial import has no lower time bound. The Unix epoch ensures that
 * no real extraction timestamp can be earlier, preventing accidental overwrites
 * of the boundary by subsequent syncs (e.g. reconciliation with absolute dates).
 */
export const UNBOUNDED_DATE_TIME_VALUE = '1970-01-01T00:00:00.000Z';

export interface SdkState {
  lastSyncStarted?: string;
  lastSuccessfulSyncStarted?: string;
  /** The oldest point of extraction (ISO 8601 timestamp). */
  workers_oldest?: string;
  /** The newest point of extraction (ISO 8601 timestamp). */
  workers_newest?: string;
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
