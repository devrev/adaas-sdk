import axios, { isAxiosError } from 'axios';

import { AdapterState, AirdropEvent } from '../types';
import { STATELESS_EVENT_TYPES } from '../common/constants';

export async function createAdapterState<ExtractorState>(
  event: AirdropEvent,
  initialState: ExtractorState
) {
  const newInitialState = structuredClone(initialState);
  const as = new State<ExtractorState>(event, newInitialState);

  if (!STATELESS_EVENT_TYPES.includes(event.payload.event_type)) {
    console.log('Fetching state');
    await as.fetchState(newInitialState);
  }

  return as;
}

export class State<ExtractorState> {
  private _state: AdapterState<ExtractorState>;

  private event: AirdropEvent;
  private workerUrl: string;
  private devrevToken: string;

  constructor(event: AirdropEvent, initialState: ExtractorState) {
    this._state = {
      lastSyncStarted: '',
      lastSuccessfulSyncStarted: '',
      ...initialState,
    };

    this.event = event;
    this.workerUrl = event.payload.event_context.worker_data_url;
    this.devrevToken = event.context.secrets.service_account_token;
  }

  get state() {
    return this._state;
  }

  set state(value) {
    this._state = value;
  }

  /**
   *  Updates the state of the adapter.
   *
   * @param {object} state - The state to be updated
   */
  async postState(state: AdapterState<ExtractorState>) {
    try {
      await axios.post(
        this.workerUrl + '.update',
        {
          state: JSON.stringify(state),
        },
        {
          headers: {
            Authorization: this.devrevToken,
          },
          params: {
            sync_unit: this.event.payload.event_context.sync_unit_id,
          },
        }
      );

      this.state = state;
      console.log('State updated successfully');
    } catch (error) {
      console.error('Failed to update state, error:' + error);
    }
  }

  /**
   *  Fetches the state of the adapter.
   *
   * @return  The state of the adapter
   */
  async fetchState(
    initialState: ExtractorState
  ): Promise<AdapterState<ExtractorState> | unknown> {
    const state: AdapterState<ExtractorState> = {
      ...initialState,
      lastSyncStarted: '',
      lastSuccessfulSyncStarted: '',
    };

    console.log(
      'Fetching state with sync unit id: ' +
        this.event.payload.event_context.sync_unit_id
    );

    try {
      const response = await axios.post(
        this.workerUrl + '.get',
        {},
        {
          headers: {
            Authorization: this.devrevToken,
          },
          params: {
            sync_unit: this.event.payload.event_context.sync_unit_id,
          },
        }
      );

      this.state = JSON.parse(response.data.state);

      console.log('State fetched successfully');
      return this.state;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        console.log('State not found, returning initial state');
        this.state = state;
        this.postState(this.state);
        return this.state;
      }

      console.error('Failed to fetch state, error:' + error);
      return error;
    }
  }
}
