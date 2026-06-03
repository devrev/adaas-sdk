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
  BaseSdkState,
  StateInterface,
  V1_SDK_STATE_KEYS,
} from './state.interfaces';

/**
 * BaseState owns the state lifecycle shared by every sync mode: connector vs.
 * SDK state separation, fetch/init/post against the platform, the v1->v2
 * migration shim, and the snap-in-version-gated initial domain mapping install.
 *
 * Mode-specific subclasses (`ExtractionState`, `LoadingState`) narrow `sdkState`
 * to their own SDK state shape and add mode-specific setup in their factories.
 *
 * @typeParam ConnectorState - the connector-owned state shape
 * @typeParam SdkState - the SDK bookkeeping shape for this mode
 */
export abstract class BaseState<ConnectorState, SdkState extends BaseSdkState> {
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

  get extractionScope(): ExtractionScope {
    return this._extractionScope;
  }

  /**
   * Installs the initial domain mapping when the snap-in version in state does
   * not match the version in the event context. Shared by all modes so that a
   * loading run still installs the mapping if extraction has not done so.
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
   * Initializes the state for this adapter instance by fetching from API
   * or creating an initial state if none exists (404).
   *
   * Reads both the v2 `{ connectorState, sdkState }` envelope and a legacy flat
   * v1 blob (connector keys merged with SDK keys), migrating the latter on read.
   * Always persists the v2 envelope going forward.
   * @param initialState The initial connector state provided by the spawn function
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
   * Normalizes a parsed on-disk state into the `{ connectorState, sdkState }`
   * envelope, migrating a legacy flat v1 blob if needed.
   *
   * - v2 envelope (`{ connectorState, sdkState }`): used as-is.
   * - v1 flat blob: SDK-owned keys (`V1_SDK_STATE_KEYS`) split into `sdkState`,
   *   everything else becomes connector state.
   * - Malformed envelope (one side present, the other missing) fails loud.
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
   *  Updates the state of the adapter by posting to API.
   *  Persists the v2 `{ connectorState, sdkState }` envelope.
   * @param {object} state - The connector state to be updated
   */
  async postState(state?: ConnectorState) {
    const url = this.workerUrl + '.update';
    this.state = state || this.state;

    const envelope: AdapterStateEnvelope<ConnectorState, SdkState> = {
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
   *  Fetches the state of the adapter from API.
   * @return  The raw state data from API
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
