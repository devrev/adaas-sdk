import { InitialDomainMapping } from '../types/common';
import { AirdropEvent } from '../types/extraction';
import { FileToLoad } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

export interface SdkState {
  lastSyncStarted?: string;
  lastSuccessfulSyncStarted?: string;
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
    lastProcessedAttachmentsIdsList?: UploadedAttachment[];
  };
}

/**
 * Attachment structure, that stores both attachment id and its parent_id for deduplication on the SDK side.
 */
export interface UploadedAttachment {
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
