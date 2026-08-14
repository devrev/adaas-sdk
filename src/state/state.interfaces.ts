import { InitialDomainMapping } from '../types/common';
import { AirSyncEvent } from '../types/extraction';
import { FileToLoad } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

export interface SdkState {
  // Pending (uncommitted) extraction boundaries (ISO 8601): set on
  // StartExtractingMetadata, reused across phases, cleared on AttachmentExtractionDone.
  pendingWorkersOldest?: string;
  pendingWorkersNewest?: string;
  // Committed extraction boundaries (ISO 8601).
  workersOldest?: string;
  workersNewest?: string;
  toDevRev?: ToDevRev;
  fromDevRev?: FromDevRev;
  snapInVersionId?: string;
}

/** v2 on-disk state shape: SDK bookkeeping kept disjoint from connector keys. */
export interface AdapterStateEnvelope<ConnectorState> {
  connectorState: ConnectorState;
  sdkState: SdkState;
}

export interface ToDevRev {
  attachmentsMetadata: {
    artifactIds: string[];
    lastProcessed: number;
    lastProcessedAttachmentsIdsList?: ProcessedAttachment[];
  };
}

export enum ProcessedAttachmentStatus {
  Success = 'success',
  Failed = 'failed',
}

/** id + parent_id identify an attachment for SDK-side deduplication. */
export interface ProcessedAttachment {
  id: string;
  parent_id: string;
  status: ProcessedAttachmentStatus;
}

export interface FromDevRev {
  filesToLoad: FileToLoad[];
}

export interface StateInterface<ConnectorState> {
  event: AirSyncEvent;
  initialState: ConnectorState;
  initialDomainMapping?: InitialDomainMapping;
  options?: WorkerAdapterOptions;
}

export const extractionSdkState = {
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

/**
 * SDK-owned top-level state keys, used to split a flat v1 blob during migration.
 * `lastSyncStarted` / `lastSuccessfulSyncStarted` are no longer on `SdkState` but
 * stay listed so v1 blobs carrying them don't leak them into connector state.
 */
export const V1_SDK_STATE_KEYS: ReadonlySet<string> = new Set<string>([
  ...Object.keys(extractionSdkState),
  ...Object.keys(loadingSdkState),
  'lastSyncStarted',
  'lastSuccessfulSyncStarted',
]);
