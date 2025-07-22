import { axios, axiosClient } from '../http/axios-client';

import { AirdropEvent, EventType, SyncMode } from '../types/extraction';
import { STATELESS_EVENT_TYPES } from '../common/constants';
import { getPrintableState, serializeError } from '../logger/logger';
import { ErrorRecord } from '../types/common';
import { installInitialDomainMapping } from '../common/install-initial-domain-mapping';

import { AdapterState, SdkState, StateInterface } from './state.interfaces';
import { getSyncDirection } from '../common/helpers';

export async function createAdapterState<ConnectorState>({
  event,
  initialState,
  initialDomainMapping,
  options,
}: StateInterface<ConnectorState>): Promise<State<ConnectorState>> {
  const newInitialState = structuredClone(initialState);
  const as = new State<ConnectorState>({
    event,
    initialState: newInitialState,
    initialDomainMapping,
    options,
  });

  if (!STATELESS_EVENT_TYPES.includes(event.payload.event_type)) {
    await as.fetchState(newInitialState);

    // Check if IDM needs to be updated
    const snapInVersionId = event.context.snap_in_version_id;
    const hasSnapInVersionInState = 'snapInVersionId' in as.state;
    const shouldUpdateIDM =
      !hasSnapInVersionInState || as.state.snapInVersionId !== snapInVersionId;

    if (!shouldUpdateIDM) {
      console.log(
        `Snap-in version in state matches the version in event context (${snapInVersionId}). Skipping initial domain mapping installation.`
      );
    } else {
      try {
        if (initialDomainMapping) {
          await installInitialDomainMapping(event, initialDomainMapping);
          as.state.snapInVersionId = snapInVersionId;
        } else {
          console.warn(
            'No initial domain mapping was passed to spawn function. Skipping initial domain mapping installation.'
          );
        }
      } catch (error) {
        console.error(
          'Error while installing initial domain mapping.',
          serializeError(error)
        );
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
  private event: AirdropEvent;
  private workerUrl: string;
  private devrevToken: string;

  constructor({ event, initialState }: StateInterface<ConnectorState>) {
    this.initialSdkState =
      getSyncDirection({ event }) === SyncMode.LOADING
        ? {
            snapInVersionId: '',
            fromDevRev: {
              filesToLoad: [],
            },
          }
        : {
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
    this._state = {
      ...initialState,
      ...this.initialSdkState,
    } as AdapterState<ConnectorState>;

    this.event = event;
    this.workerUrl = event.payload.event_context.worker_data_url;
    this.devrevToken = event.context.secrets.service_account_token;
  }

  get state(): AdapterState<ConnectorState> {
    return this._state;
  }

  set state(value: AdapterState<ConnectorState>) {
    this._state = value;
  }

  /**
   *  Updates the state of the adapter.
   *
   * @param {object} state - The state to be updated
   */
  async postState(state?: AdapterState<ConnectorState>) {
    try {
      await axiosClient.post(
        this.workerUrl + '.update',
        {
          state: JSON.stringify(state || this.state),
        },
        {
          headers: {
            Authorization: this.devrevToken,
          },
          params: {
            sync_unit: this.event.payload.event_context.sync_unit_id,
            request_id: this.event.payload.event_context.uuid,
          },
        }
      );

      this.state = state || this.state;
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
   *  Fetches the state of the adapter.
   *
   * @return  The state of the adapter
   */
  async fetchState(
    initialState: ConnectorState
  ): Promise<AdapterState<ConnectorState> | ErrorRecord> {
    console.log(
      'Fetching state with sync unit id: ' +
        this.event.payload.event_context.sync_unit_id +
        '.'
    );

    try {
      const response = await axiosClient.get(this.workerUrl + '.get', {
        headers: {
          Authorization: this.devrevToken,
        },
        params: {
          sync_unit: this.event.payload.event_context.sync_unit_id,
          request_id: this.event.payload.event_context.uuid,
        },
      });

      this.state = JSON.parse(response.data.state);

      console.log(
        'State fetched successfully. Current state',
        getPrintableState(this.state)
      );

      return this.state;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        const state: AdapterState<ConnectorState> = {
          ...initialState,
          ...this.initialSdkState,
        };

        this.state = state;

        console.log(
          'State not found, returning initial state. Current state',
          getPrintableState(this.state)
        );
        await this.postState(this.state);
        return this.state;
      } else {
        console.error('Failed to fetch state.', error);
        process.exit(1);
      }
    }
  }
}
