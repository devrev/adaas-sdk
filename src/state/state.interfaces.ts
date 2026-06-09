import { InitialDomainMapping } from '../types/common';
import { AirSyncEvent } from '../types/extraction';
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
 * AdapterState is the legacy (v1) flat adapter state: connector state merged
 * with SDK bookkeeping in a single object.
 *
 * @deprecated v2 persists the `{ connectorState, sdkState }` envelope
 * (see {@link AdapterStateEnvelope}). Connector state is now exposed via
 * `adapter.state` and SDK state is kept internal.
 */
export type AdapterState<ConnectorState> = ConnectorState & SdkState;

/**
 * AdapterStateEnvelope is the v2 on-disk state shape: connector state and SDK
 * bookkeeping are stored as disjoint sub-objects so SDK internals stay
 * encapsulated and never collide with connector keys.
 */
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

/**
 * The set of top-level state keys owned by the SDK. Derived from the initial
 * SDK state constants so it auto-updates whenever a new SDK field is added.
 * Used by the migration shim to split a flat v1 state blob into the
 * `{ connectorState, sdkState }` envelope: keys in this set go to `sdkState`,
 * everything else is connector state.
 */
export const V1_SDK_STATE_KEYS: ReadonlySet<string> = new Set<string>([
  ...Object.keys(extractionSdkState),
  ...Object.keys(loadingSdkState),
]);
