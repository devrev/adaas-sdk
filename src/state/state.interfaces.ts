import { InitialDomainMapping } from '../types/common';
import { AirSyncEvent } from '../types/extraction';
import { FileToLoad } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * BaseSdkState holds SDK bookkeeping common to every sync mode.
 */
export interface BaseSdkState {
  snapInVersionId?: string;
}

/**
 * ExtractionSdkState holds SDK bookkeeping owned by the extraction modes.
 */
export interface ExtractionSdkState extends BaseSdkState {
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
}

/**
 * LoadingSdkState holds SDK bookkeeping owned by the loading modes.
 */
export interface LoadingSdkState extends BaseSdkState {
  fromDevRev?: FromDevRev;
}

/**
 * AdapterStateEnvelope is the v2 on-disk state shape: connector state and SDK
 * bookkeeping are stored as disjoint sub-objects so SDK internals stay
 * encapsulated and never collide with connector keys.
 */
export interface AdapterStateEnvelope<
  ConnectorState,
  SdkState extends BaseSdkState
> {
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
  event: AirSyncEvent;
  initialState: ConnectorState;
  initialDomainMapping?: InitialDomainMapping;
  options?: WorkerAdapterOptions;
}

export const initialExtractionSdkState: ExtractionSdkState = {
  snapInVersionId: '',
  pendingWorkersOldest: '',
  pendingWorkersNewest: '',
  workersOldest: '',
  workersNewest: '',
  toDevRev: {
    attachmentsMetadata: {
      artifactIds: [],
      lastProcessed: 0,
      lastProcessedAttachmentsIdsList: [],
    },
  },
};

export const initialLoadingSdkState: LoadingSdkState = {
  snapInVersionId: '',
  fromDevRev: {
    filesToLoad: [],
  },
};

/**
 * The set of top-level state keys owned by the SDK. Derived from the initial
 * SDK state constants so it auto-updates whenever a new SDK field is added.
 * Used by the migration shim to split a flat v1 state blob into the
 * `{ connectorState, sdkState }` envelope: keys in this set go to `sdkState`,
 * everything else is connector state.
 */
export const V1_SDK_STATE_KEYS: ReadonlySet<string> = new Set([
  ...Object.keys(initialExtractionSdkState),
  ...Object.keys(initialLoadingSdkState),
]);
