import axios from 'axios';

import { STATELESS_EVENT_TYPES } from '../common/constants';
import { getSyncDirection } from '../common/helpers';
import { installInitialDomainMapping } from '../common/install-initial-domain-mapping';
import { axiosClient } from '../http/axios-client-internal';
import { getPrintableState, serializeError } from '../logger/logger';
import { SyncMode } from '../types/common';
import { EventType } from '../types/extraction';

import {
  AdapterState,
  extractionSdkState,
  loadingSdkState,
  SdkState,
  StateInterface,
} from './state.interfaces';

export async function createAdapterState<ConnectorState>({
  event,
  initialState,
  initialDomainMapping,
  options,
}: StateInterface<ConnectorState>): Promise<State<ConnectorState>> {
  // Deep clone the initial state to avoid mutating the original state
  const deepCloneInitialState: ConnectorState = structuredClone(initialState);

  const as = new State<ConnectorState>({
    event,
    initialState: deepCloneInitialState,
    initialDomainMapping,
    options,
  });

  if (!STATELESS_EVENT_TYPES.includes(event.payload.event_type)) {
    await as.init(deepCloneInitialState);

    // Check if IDM needs to be updated
    const snapInVersionId = event.context.snap_in_version_id;
    const hasSnapInVersionInState = 'snapInVersionId' in as.state;
    const shouldUpdateIDM =
      !hasSnapInVersionInState || as.state.snapInVersionId !== snapInVersionId;

    if (!shouldUpdateIDM) {
      console.log(
        `Snap-in version in state matches the version in event context "${snapInVersionId}". Skipping initial domain mapping installation.`
      );
    } else {
      try {
        console.log(
          `Snap-in version in state "${as.state.snapInVersionId}" does not match the version in event context "${snapInVersionId}". Installing initial domain mapping.`
        );

        if (initialDomainMapping) {
          await installInitialDomainMapping(event, initialDomainMapping);
          as.state.snapInVersionId = snapInVersionId;
        } else {
          throw new Error(
            'No initial domain mapping was passed to spawn function. Skipping initial domain mapping installation.'
          );
        }
      } catch (error) {
        console.error(
          'Error while installing initial domain mapping.',
          serializeError(error)
        );
        process.exit(1);
      }
    }

    // Set lastSyncStarted if the event type is ExtractionDataStart
    if (
      event.payload.event_type === EventType.ExtractionDataStart &&
      !as.state.lastSyncStarted
    ) {
      as.state.lastSyncStarted = new Date().toISOString();
      console.log(`Setting lastSyncStarted to ${as.state.lastSyncStarted}.`);
    }
  }

  return as;
}

export class State<ConnectorState> {
  private _state: AdapterState<ConnectorState>;
  private initialSdkState: SdkState;
  private workerUrl: string;
  private devrevToken: string;
  private syncUnitId: string;
  private requestId: string;

  constructor({ event, initialState }: StateInterface<ConnectorState>) {
    this.initialSdkState =
      getSyncDirection({ event }) === SyncMode.LOADING
        ? loadingSdkState
        : extractionSdkState;
    this._state = {
      ...initialState,
      ...this.initialSdkState,
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

  /**
   * Initializes the state for this adapter instance by fetching from API
   * or creating an initial state if none exists (404).
   * @param initialState The initial connector state provided by the spawn function
   */
  async init(initialState: ConnectorState): Promise<void> {
    try {
      const stringifiedState = await this.fetchState();
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
        console.error('Failed to init state.', serializeError(error));
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
      console.error('Failed to stringify state.', serializeError(error));
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
      console.error('Failed to update the state.', serializeError(error));
      process.exit(1);
    }
  }

  /**
   *  Fetches the state of the adapter from API.
   * @return  The raw state data from API
   */
  async fetchState(): Promise<string> {
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

    return response.data?.state;
  }
}
