import axios from 'axios';
import { parentPort } from 'node:worker_threads';

import { installInitialDomainMapping } from '../common/install-initial-domain-mapping';
import { axiosClient } from '../http/axios-client-internal';
import { getPrintableState, serializeError } from '../logger/logger';
import { InitialDomainMapping } from '../types/common';
import { AirSyncEvent } from '../types/extraction';
import { WorkerMessageSubject } from '../types/workers';
import { ExtractionScope } from '../types/workers';

import { AdapterState, SdkState, StateInterface } from './state.interfaces';

/**
 * BaseState owns the state lifecycle shared by every sync mode: holding the
 * adapter state, fetching/initializing/posting it against the platform, and the
 * snap-in-version-gated initial domain mapping install.
 *
 * Mode-specific subclasses (`ExtractionState`, `LoadingState`) seed the
 * SDK-owned portion of the state and add mode-specific setup in their factories.
 *
 * @typeParam ConnectorState - the connector-owned state shape
 */
export abstract class BaseState<ConnectorState> {
  protected _state: AdapterState<ConnectorState>;
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
    this._state = {
      ...initialState,
      ...initialSdkState,
    } as AdapterState<ConnectorState>;
    this.workerUrl = event.payload.event_context.worker_data_url;
    this.devrevToken = event.context.secrets.service_account_token;
    this.syncUnitId = event.payload.event_context.sync_unit_id;
    this.requestId = event.payload.event_context.request_id_adaas;
  }

  get state(): AdapterState<ConnectorState> {
    return this._state;
  }

  set state(value: AdapterState<ConnectorState>) {
    this._state = value;
  }

  get extractionScope(): ExtractionScope {
    return this._extractionScope;
  }

  /**
   * Installs the initial domain mapping when the snap-in version in state does
   * not match the version in the event context. Shared by all modes so that a
   * loading run still installs the mapping if extraction has not done so.
   * @param initialDomainMapping The initial domain mapping passed to spawn
   */
  async installInitialDomainMappingIfNeeded(
    initialDomainMapping?: InitialDomainMapping
  ): Promise<void> {
    const snapInVersionId = this.event.context.snap_in_version_id;
    const hasSnapInVersionInState = 'snapInVersionId' in this.state;
    const shouldUpdateIDM =
      !hasSnapInVersionInState ||
      this.state.snapInVersionId !== snapInVersionId;

    if (!shouldUpdateIDM) {
      console.log(
        `Snap-in version in state matches the version in event context "${snapInVersionId}". Skipping initial domain mapping installation.`
      );
      return;
    }

    try {
      console.log(
        `Snap-in version in state "${this.state.snapInVersionId}" does not match the version in event context "${snapInVersionId}". Installing initial domain mapping.`
      );

      if (initialDomainMapping) {
        await installInitialDomainMapping(this.event, initialDomainMapping);
        this.state.snapInVersionId = snapInVersionId;
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
   * @param initialState The initial connector state provided by the spawn function
   */
  async init(initialState: ConnectorState): Promise<void> {
    try {
      const { state: stringifiedState, objects } = await this.fetchState();
      if (!stringifiedState) {
        throw new Error('No state found in response.');
      }

      let parsedState: AdapterState<ConnectorState>;
      try {
        parsedState = JSON.parse(stringifiedState);
      } catch (error) {
        throw new Error(`Failed to parse state. ${error}`);
      }

      this.state = parsedState;
      console.log(
        'State fetched successfully. Current state',
        getPrintableState(this.state)
      );

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
        const initialAdapterState: AdapterState<ConnectorState> = {
          ...initialState,
          ...this.initialSdkState,
        };

        this.state = initialAdapterState;
        await this.postState(initialAdapterState);
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
   *  Updates the state of the adapter by posting to API.
   * @param {object} state - The state to be updated
   */
  async postState(state?: AdapterState<ConnectorState>) {
    const url = this.workerUrl + '.update';
    this.state = state || this.state;

    let stringifiedState: string;
    try {
      stringifiedState = JSON.stringify(this.state);
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

      console.log(
        'State updated successfully to',
        getPrintableState(this.state)
      );
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
