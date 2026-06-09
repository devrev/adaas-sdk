import axios from 'axios';
import { parentPort } from 'node:worker_threads';

import { installInitialDomainMapping } from '../common/install-initial-domain-mapping';
import { axiosClient } from '../http/axios-client-internal';
import { getPrintableState, serializeError } from '../logger/logger';
import { InitialDomainMapping } from '../types/common';
import { AirSyncEvent } from '../types/extraction';
import { WorkerMessageSubject } from '../types/workers';
import { ExtractionScope } from '../types/workers';

import {
  AdapterStateEnvelope,
  SdkState,
  StateInterface,
  V1_SDK_STATE_KEYS,
} from './state.interfaces';

/**
 * Abstract base owning the adapter state lifecycle shared by every sync mode.
 *
 * Used to keep connector-owned state separate from SDK bookkeeping, fetch/init/
 * post the persisted state against the platform, run the v1->v2 migration shim,
 * and install the initial domain mapping gated on the snap-in version.
 * Mode-specific subclasses (`ExtractionState`, `LoadingState`) seed the
 * SDK-owned portion of the state and add mode-specific setup in their factories.
 *
 * @typeParam ConnectorState - the connector-owned state shape
 */
export abstract class BaseState<ConnectorState> {
  protected _connectorState: ConnectorState;
  protected _sdkState: SdkState;
  protected _extractionScope: ExtractionScope = {};
  protected readonly initialSdkState: SdkState;
  protected readonly event: AirSyncEvent;
  private workerUrl: string;
  private devrevToken: string;
  private syncUnitId: string;
  private requestId: string;

  constructor(
    { event, initialState }: StateInterface<ConnectorState>,
    initialSdkState: SdkState
  ) {
    this.event = event;
    this.initialSdkState = initialSdkState;
    this._connectorState = initialState;
    this._sdkState = { ...initialSdkState };
    this.workerUrl = event.payload.event_context.worker_data_url;
    this.devrevToken = event.context.secrets.service_account_token;
    this.syncUnitId = event.payload.event_context.sync_unit_id;
    this.requestId = event.payload.event_context.request_id_adaas;
  }

  /** Connector-owned state. This is what `adapter.state` exposes to snap-in code. */
  get state(): ConnectorState {
    return this._connectorState;
  }

  set state(value: ConnectorState) {
    this._connectorState = value;
  }

  /** SDK-internal bookkeeping state. Never exposed to connector code. */
  get sdkState(): SdkState {
    return this._sdkState;
  }

  set sdkState(value: SdkState) {
    this._sdkState = value;
  }

  /** The per-sync-unit extraction scope (object types to extract), loaded alongside state. */
  get extractionScope(): ExtractionScope {
    return this._extractionScope;
  }

  /**
   * Installs the initial domain mapping when the version in state is stale.
   *
   * Used by all modes (so a loading run still installs the mapping if extraction
   * has not) to (re)install whenever `sdkState.snapInVersionId` is absent or
   * differs from the event context's snap-in version; on success the new version
   * is recorded in state. A missing mapping or install error fails the worker.
   *
   * @param initialDomainMapping - The initial domain mapping of type InitialDomainMapping passed to the spawn function; required when an install is needed
   * @returns Promise that resolves once the mapping is installed or the install is skipped
   */
  async installInitialDomainMappingIfNeeded(
    initialDomainMapping?: InitialDomainMapping
  ): Promise<void> {
    const snapInVersionId = this.event.context.snap_in_version_id;
    const hasSnapInVersionInState = 'snapInVersionId' in this.sdkState;
    const shouldUpdateIDM =
      !hasSnapInVersionInState ||
      this.sdkState.snapInVersionId !== snapInVersionId;

    if (!shouldUpdateIDM) {
      console.log(
        `Snap-in version in state matches the version in event context "${snapInVersionId}". Skipping initial domain mapping installation.`
      );
      return;
    }

    try {
      console.log(
        `Snap-in version in state "${this.sdkState.snapInVersionId}" does not match the version in event context "${snapInVersionId}". Installing initial domain mapping.`
      );

      if (initialDomainMapping) {
        await installInitialDomainMapping(this.event, initialDomainMapping);
        this.sdkState.snapInVersionId = snapInVersionId;
      } else {
        throw new Error(
          'No initial domain mapping was passed to spawn function. Skipping initial domain mapping installation.'
        );
      }
    } catch (error) {
      const errorMessage = `Error while installing initial domain mapping. ${serializeError(
        error
      )}`;
      console.error(errorMessage);
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageFailed,
        payload: { message: errorMessage },
      });
      process.exit(1);
    }
  }

  /**
   * Initializes this adapter's state from persisted state, or seeds it on first run.
   *
   * Used at worker start to load and normalize state: it fetches the persisted
   * blob, parses it, and runs `normalizeFetchedState` so both the v2
   * `{ connectorState, sdkState }` envelope and a legacy flat v1 blob are
   * accepted (the latter migrated on read). It also restores the extraction
   * scope. On a 404 it seeds the initial state and persists the v2 envelope;
   * any other failure fails the worker.
   *
   * @param initialState - The initial connector state of type ConnectorState provided by the spawn function, used when no state exists yet
   * @returns Promise that resolves once state has been loaded or seeded
   */
  async init(initialState: ConnectorState): Promise<void> {
    try {
      const { state: stringifiedState, objects } = await this.fetchState();
      if (!stringifiedState) {
        throw new Error('No state found in response.');
      }

      let parsed: unknown;
      try {
        parsed = JSON.parse(stringifiedState);
      } catch (error) {
        throw new Error(`Failed to parse state. ${error}`);
      }

      const { connectorState, sdkState } = this.normalizeFetchedState(parsed);
      this.state = connectorState;
      this.sdkState = sdkState;

      console.log('State fetched successfully. Current state', {
        connectorState: getPrintableState(
          this.state as Record<string, unknown>
        ),
        sdkState: getPrintableState(this.sdkState),
      });

      if (objects) {
        try {
          this._extractionScope = JSON.parse(objects);
        } catch (error) {
          console.warn(`Failed to parse extractionScope. ${error}`);
        }
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        console.log('State not found. Initializing state with initial state.');
        this.state = initialState;
        this.sdkState = { ...this.initialSdkState };
        await this.postState();
      } else {
        const errorMessage = `Failed to init state. ${serializeError(error)}`;
        console.error(errorMessage);
        parentPort?.postMessage({
          subject: WorkerMessageSubject.WorkerMessageFailed,
          payload: { message: errorMessage },
        });
        process.exit(1);
      }
    }
  }

  /**
   * Normalizes parsed on-disk state into the `{ connectorState, sdkState }` envelope, migrating legacy v1 state.
   *
   * Used as the v1->v2 migration shim so older snap-ins keep working after the
   * state split. Behavior by shape of the parsed input:
   * - v2 envelope (`{ connectorState, sdkState }`): used as-is, with `sdkState`
   *   merged over the mode's initial SDK state to backfill newly added fields.
   * - Legacy v1 flat blob: top-level keys present in `V1_SDK_STATE_KEYS` are
   *   split into `sdkState`, everything else becomes connector state.
   * - Malformed envelope (one of `connectorState`/`sdkState` present, the other
   *   missing) or non-object input: throws.
   *
   * @param parsed - The JSON-parsed persisted state of unknown shape (v2 envelope or legacy v1 flat blob)
   * @returns The split state as `{ connectorState, sdkState }`, with `sdkState` merged over the initial SDK state
   * @throws Error when the input is not an object or is a malformed envelope
   */
  private normalizeFetchedState(parsed: unknown): {
    connectorState: ConnectorState;
    sdkState: SdkState;
  } {
    if (parsed === null || typeof parsed !== 'object') {
      throw new Error('Fetched state is not a JSON object.');
    }

    const record = parsed as Record<string, unknown>;
    const hasConnector = 'connectorState' in record;
    const hasSdk = 'sdkState' in record;

    if (hasConnector || hasSdk) {
      if (!hasConnector || !hasSdk) {
        throw new Error(
          'Malformed state envelope: expected both "connectorState" and "sdkState".'
        );
      }
      return {
        connectorState: record.connectorState as ConnectorState,
        sdkState: { ...this.initialSdkState, ...(record.sdkState as SdkState) },
      };
    }

    // Legacy flat v1 blob: split known SDK keys out of the connector state.
    const connectorState: Record<string, unknown> = {};
    const sdkState: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(record)) {
      if (V1_SDK_STATE_KEYS.has(key)) {
        sdkState[key] = value;
      } else {
        connectorState[key] = value;
      }
    }

    return {
      connectorState: connectorState as ConnectorState,
      sdkState: { ...this.initialSdkState, ...(sdkState as SdkState) },
    };
  }

  /**
   * Persists the adapter state to the platform.
   *
   * Used to checkpoint progress: wraps the current connector and SDK state into
   * the v2 `{ connectorState, sdkState }` envelope, serializes it, and posts it.
   * A serialization or request failure fails the worker.
   *
   * @param state - Optional connector state of type ConnectorState to set and persist; when omitted the current `this.state` is used
   * @returns Promise that resolves once the state has been persisted
   */
  async postState(state?: ConnectorState) {
    const url = this.workerUrl + '.update';
    this.state = state || this.state;

    const envelope: AdapterStateEnvelope<ConnectorState> = {
      connectorState: this.state,
      sdkState: this.sdkState,
    };

    let stringifiedState: string;
    try {
      stringifiedState = JSON.stringify(envelope);
    } catch (error) {
      const errorMessage = `Failed to stringify state. ${serializeError(
        error
      )}`;
      console.error(errorMessage);
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageFailed,
        payload: { message: errorMessage },
      });
      process.exit(1);
    }

    try {
      await axiosClient.post(
        url,
        {
          state: stringifiedState,
        },
        {
          headers: {
            Authorization: this.devrevToken,
          },
          params: {
            sync_unit: this.syncUnitId,
            request_id: this.requestId,
          },
        }
      );

      console.log('State updated successfully to', {
        connectorState: getPrintableState(
          this.state as Record<string, unknown>
        ),
        sdkState: getPrintableState(this.sdkState),
      });
    } catch (error) {
      const errorMessage = `Failed to update the state. ${serializeError(
        error
      )}`;
      console.error(errorMessage);
      parentPort?.postMessage({
        subject: WorkerMessageSubject.WorkerMessageFailed,
        payload: { message: errorMessage },
      });
      process.exit(1);
    }
  }

  /**
   * Fetches the raw persisted adapter state from the platform.
   *
   * Used by `init` to read the stored state before normalization; returns the
   * raw, still-stringified payload without parsing or migrating it.
   *
   * @returns Promise resolving to `{ state, objects }`, where `state` is the stringified state blob and `objects` is the optional stringified extraction scope
   */
  async fetchState(): Promise<{ state: string; objects?: string }> {
    console.log(
      `Fetching state with sync unit id ${this.syncUnitId} and request id ${this.requestId}.`
    );

    const url = this.workerUrl + '.get';
    const response = await axiosClient.get(url, {
      headers: {
        Authorization: this.devrevToken,
      },
      params: {
        sync_unit: this.syncUnitId,
        request_id: this.requestId,
      },
    });

    return {
      state: response.data?.state,
      objects: response.data?.objects,
    };
  }
}
