import axios, { isAxiosError } from 'axios';

import {
  AirdropEvent,
  ExtractorEventType,
  ExtractorEvent,
  EventData,
  AdapterState,
  Artifact,
} from '../types';

import { STATELESS_EVENT_TYPES } from '../common/constants';
import { getTimeoutExtractorEventType } from '../common/helpers';
import { Logger } from '../logging';

/**
 * Adapter class is used to interact with Airdrop platform. The class provides
 * utilities to
 *  - emit control events to the platform
 *  - update the state of the extractor
 *  - set the last saved state in case of a timeout
 *
 * @class Adapter
 * @constructor
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {object=} initialState - The initial state of the adapter
 * @param {boolean=} isLocalDevelopment - A flag to indicate if the adapter is being used in local development
 */

/**
 *  Creates an adapter instance.
 *
 * @param {AirdropEvent} event - The event object received from the platform
 * @param initialState
 * @param {boolean=} isLocalDevelopment - A flag to indicate if the adapter is being used in local development
 * @return  The adapter instance
 */

export async function createAdapter<ExtractorState>(
  event: AirdropEvent,
  initialState: AdapterState<ExtractorState>,
  isLocalDevelopment: boolean = false
) {
  console.log('initialState in createAdapter: ', initialState);

  const newInitialState = { ...initialState };

  const a = new Adapter<ExtractorState>(
    event,
    newInitialState,
    isLocalDevelopment
  );

  console.log('Creating new adapter');
  if (!STATELESS_EVENT_TYPES.includes(event.payload.event_type)) {
    await a.fetchState(newInitialState);
  }
  return a;
}

export class Adapter<ExtractorState> {
  private _state: AdapterState<ExtractorState>;
  private _artifacts: Artifact[];

  private event: AirdropEvent;
  private callbackUrl: string;
  private workerUrl: string;
  private devrevToken: string;
  private startTime: number;
  private heartBeatFn: NodeJS.Timeout;
  private exit: boolean = false;
  private lambdaTimeout: number = 10 * 60 * 1000; // 10 minutes in milliseconds
  private heartBeatInterval: number = 30 * 1000; // 30 seconds in milliseconds

  constructor(
    event: AirdropEvent,
    initialState: AdapterState<ExtractorState>,
    isLocalDevelopment: boolean = false
  ) {
    if (!isLocalDevelopment) {
      Logger.init(event);
    }

    this._state = { ...initialState };
    this._artifacts = [];

    this.event = event;
    this.callbackUrl = event.payload.event_context.callback_url;
    this.workerUrl = event.payload.event_context.worker_data_url;
    this.devrevToken = event.context.secrets.service_account_token;

    this.startTime = Date.now();

    // Run heartbeat every 30 seconds
    this.heartBeatFn = setInterval(async () => {
      const b = await this.heartbeat();
      if (b) {
        this.exitAdapter();
      }
    }, this.heartBeatInterval);
  }

  get state(): AdapterState<ExtractorState> {
    return this._state;
  }

  set state(value: AdapterState<ExtractorState>) {
    this._state = value;
  }

  get artifacts(): Artifact[] {
    return this._artifacts;
  }

  set artifacts(value: Artifact[]) {
    this._artifacts = value;
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

      this._state = state;
      console.log('State updated successfully');
    } catch (error) {
      console.error('Failed to update state, error:' + error);
      this.emit(ExtractorEventType.ExtractionDataError, {
        error: { message: 'Failed to update state' },
      });
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

      this._state = JSON.parse(response.data.state);

      console.log('State fetched successfully');
      return this._state;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 404) {
        console.log('State not found, returning initial state');
        this._state = state;
        this.postState(this._state);
        return this._state;
      }

      console.error('Failed to fetch state, error:' + error);
      return error;
    }
  }

  /**
   *  Emits an event to the platform.
   *
   * @param {ExtractorEventType} newEventType - The event type to be emitted
   * @param {EventData=} data - The data to be sent with the event
   */
  async emit(newEventType: ExtractorEventType, data?: EventData) {
    if (this.exit) {
      console.warn(
        'Adapter is already in exit state. No more events can be emitted.'
      );
      return;
    }

    // We want to save the state every time we emit an event, except for the start and delete events
    if (!STATELESS_EVENT_TYPES.includes(this.event.payload.event_type)) {
      console.log(`Saving state before emitting event`);
      await this.postState(this._state);
    }

    const newEvent: ExtractorEvent = {
      event_type: newEventType,
      event_context: {
        uuid: this.event.payload.event_context.uuid,
        sync_run: this.event.payload.event_context.sync_run_id,
        ...(this.event.payload.event_context.sync_unit_id && {
          sync_unit: this.event.payload.event_context.sync_unit_id,
        }),
      },
      event_data: {
        ...data,
      },
    };

    try {
      await axios.post(
        this.callbackUrl,
        { ...newEvent },
        {
          headers: {
            Accept: 'application/json, text/plain, */*',
            Authorization: this.devrevToken,
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Successfully emitted event: ' + JSON.stringify(newEvent));
    } catch (error) {
      // If this request fails the extraction will be stuck in loop and
      // we need to stop it through UI or think about retrying this request
      console.log(
        'Failed to emit event: ' +
          JSON.stringify(newEvent) +
          ', error: ' +
          error
      );
    } finally {
      this.exitAdapter();
    }
  }

  /**
   * Exit the adapter. This will stop the heartbeat and no
   * further events will be emitted.
   */
  private exitAdapter() {
    this.exit = true;
    clearInterval(this.heartBeatFn);
  }

  /**
   * Heartbeat function to check if the lambda is about to timeout.
   * @returns true if 10 minutes have passed since the start of the lambda.
   */
  private async heartbeat(): Promise<boolean> {
    if (this.exit) {
      return true;
    }
    if (Date.now() - this.startTime > this.lambdaTimeout) {
      const timeoutEventType = getTimeoutExtractorEventType(
        this.event.payload.event_type
      );
      if (timeoutEventType !== null) {
        const { eventType, isError } = timeoutEventType;
        const err = isError ? { message: 'Lambda Timeout' } : undefined;
        await this.emit(eventType, { error: err, artifacts: this._artifacts });
        return true;
      }
    }
    return false;
  }
}
