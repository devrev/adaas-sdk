import { InitialDomainMapping } from '../types/common';
import { AirSyncEvent } from '../types/extraction';
import { FileToLoad } from '../types/loading';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * The SDK-owned portion of the persisted adapter state.
 *
 * Used to hold bookkeeping the SDK manages itself (extraction-window boundaries,
 * attachments/files progress, installed snap-in version) separately from
 * connector-owned state, so SDK internals never collide with connector keys.
 */
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
  /** The committed oldest point of extraction (ISO 8601 timestamp). */
  workersOldest?: string;
  /** The committed newest point of extraction (ISO 8601 timestamp). */
  workersNewest?: string;
  /** Attachments-extraction bookkeeping (artifact ids, progress cursor). Extraction mode only. */
  toDevRev?: ToDevRev;
  /** Loading bookkeeping (files still to load into DevRev). Loading mode only. */
  fromDevRev?: FromDevRev;
  /** The snap-in version id whose initial domain mapping is installed; drives reinstall on change. */
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

/**
 * SDK-owned attachments-extraction state (external system -> DevRev direction).
 *
 * Used to track which attachment artifacts have been streamed and how far the
 * attachments phase has progressed so it can resume after a timeout.
 */
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

/**
 * SDK-owned loading state (DevRev -> external system direction).
 *
 * Used to track which files still need to be loaded into the external system so
 * the loading phase can resume after a timeout.
 */
export interface FromDevRev {
  filesToLoad: FileToLoad[];
}

/**
 * Constructor/factory parameters for building an adapter state instance.
 *
 * Used by `createAdapterState` and the per-mode factories to carry the AirSync
 * event, the connector's seed state, and the optional initial domain mapping and
 * worker options.
 */
export interface StateInterface<ConnectorState> {
  event: AirSyncEvent;
  initialState: ConnectorState;
  initialDomainMapping?: InitialDomainMapping;
  options?: WorkerAdapterOptions;
}

/**
 * The initial SDK state seeded for extraction-mode workers.
 *
 * Used by `ExtractionState` as the baseline `sdkState` (extraction-window
 * boundaries plus attachments bookkeeping) before any persisted state is merged in.
 */
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

/**
 * The initial SDK state seeded for loading-mode workers.
 *
 * Used by `LoadingState` as the baseline `sdkState` (files-to-load bookkeeping)
 * before any persisted state is merged in.
 */
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
