import axios from 'axios';

import { Artifact } from '../../uploader/uploader.interfaces';
import {
  AirdropEvent,
  ExtractorEventType,
  ExtractorEvent,
  EventData,
} from '../../types/extraction';

import { AdapterState } from '../../state/state.interfaces';

import { STATELESS_EVENT_TYPES } from '../../common/constants';
import { getTimeoutExtractorEventType } from '../common/helpers';
// import { Logger } from '../../logger/logger';
import { State, createAdapterState } from '../../state/state';

/**
 * Adapter class is used to interact with Airdrop platform. The class provides
 * utilities to
 *  - emit control events to the platform
 *  - update the state of the extractor
 *  - set the last saved state in case of a timeout
 *
 * @class Adapter
 * @constructor
 * @deprecated
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

export async function createAdapter<ConnectorState>(
  event: AirdropEvent,
  initialState: ConnectorState,
  isLocalDevelopment: boolean = false
) {
  const newInitialState = structuredClone(initialState);
  const adapterState: State<ConnectorState> = await createAdapterState({
    event,
    initialState: newInitialState,
  });

  const a = new Adapter<ConnectorState>(
    event,
    adapterState,
    isLocalDevelopment
  );

  return a;
}

export class Adapter<ConnectorState> {
  private adapterState: State<ConnectorState>;
  private _artifacts: Artifact[];

  private event: AirdropEvent;
  private callbackUrl: string;
  private devrevToken: string;
  private startTime: number;
  private heartBeatFn: ReturnType<typeof setTimeout> | undefined;
  private exit: boolean = false;
  private lambdaTimeout: number = 10 * 60 * 1000; // 10 minutes in milliseconds
  private heartBeatInterval: number = 30 * 1000; // 30 seconds in milliseconds

  constructor(
    event: AirdropEvent,
    adapterState: State<ConnectorState>,
    isLocalDevelopment: boolean = false
  ) {
    if (!isLocalDevelopment) {
      //   Logger.init(event);
    }

    this.adapterState = adapterState;
    this._artifacts = [];

    this.event = event;
    this.callbackUrl = event.payload.event_context.callback_url;
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

  get state(): AdapterState<ConnectorState> {
    return this.adapterState.state;
  }

  set state(value: AdapterState<ConnectorState>) {
    this.adapterState.state = value;
  }

  get artifacts(): Artifact[] {
    return this._artifacts;
  }

  set artifacts(value: Artifact[]) {
    this._artifacts = value;
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
      await this.adapterState.postState(this.state);
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
