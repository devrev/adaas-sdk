import { parentPort } from 'node:worker_threads';

import { STATELESS_EVENT_TYPES } from '../../common/constants';
import { emit } from '../../common/control-protocol';
import { truncateMessage } from '../../common/helpers';
import { serializeError } from '../../logger/logger';
import { runWithSdkLogContext } from '../../logger/logger.context';
import { BaseState } from '../../state/state';
import { SdkState } from '../../state/state.interfaces';
import {
  AirSyncEvent,
  EventData,
  ExtractorEventType,
} from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';
import {
  WorkerAdapterOptions,
  WorkerMessageEmitted,
  WorkerMessageSubject,
} from '../../types/workers';
import { Uploader } from '../../uploader/uploader';

/**
 * BaseAdapter holds the state and behavior shared by both sync modes and owns
 * the `emit` control-protocol flow as a template method. Mode-specific adapters
 * (`ExtractionAdapter`, `LoadingAdapter`) implement the abstract hooks to inject
 * their own pre-emit work and event payload shaping.
 *
 * @typeParam ConnectorState - the connector-owned state shape
 */
export abstract class BaseAdapter<ConnectorState> {
  readonly event: AirSyncEvent;
  readonly options?: WorkerAdapterOptions;
  isTimeout: boolean;
  hasWorkerEmitted: boolean;

  protected adapterState: BaseState<ConnectorState>;
  protected uploader: Uploader;

  constructor({
    event,
    adapterState,
    options,
  }: {
    event: AirSyncEvent;
    adapterState: BaseState<ConnectorState>;
    options?: WorkerAdapterOptions;
  }) {
    this.event = event;
    this.options = options;
    this.adapterState = adapterState;
    this.hasWorkerEmitted = false;
    this.isTimeout = false;
    this.uploader = new Uploader({
      event,
      options,
    });
  }

  /** Connector-owned state exposed to snap-in code. */
  get state(): ConnectorState {
    return this.adapterState.state;
  }

  set state(value: ConnectorState) {
    this.adapterState.state = value;
  }

  /** SDK-internal bookkeeping state. Used by SDK internals; not for connector use. */
  get sdkState(): SdkState {
    return this.adapterState.sdkState;
  }

  get extractionScope() {
    return this.adapterState.extractionScope;
  }

  async postState() {
    return runWithSdkLogContext(async () => {
      await this.adapterState.postState();
    });
  }

  /**
   * Pre-emit hook run before any state is persisted or the event is sent.
   * Extraction uploads pending repos and updates extraction boundaries here;
   * loading has nothing to do. Throwing aborts the emit (the caller signals
   * worker exit).
   */
  protected abstract beforeEmit(
    newEventType: ExtractorEventType | LoaderEventType
  ): Promise<void>;

  /**
   * Builds the mode-specific extras merged into the emitted event payload
   * (extraction: artifacts; loading: reports + processed files).
   */
  protected abstract buildEmitPayload(
    newEventType: ExtractorEventType | LoaderEventType
  ): EventData;

  /**
   * Post-emit hook run after the event has been sent successfully. Extraction
   * clears its accumulated artifacts here; loading has nothing to do.
   */
  protected abstract afterEmit(
    newEventType: ExtractorEventType | LoaderEventType
  ): void;

  /**
   *  Emits an event to the platform.
   *
   * @param newEventType - The event type to be emitted
   * @param data - The data to be sent with the event
   */
  async emit(
    newEventType: ExtractorEventType | LoaderEventType,
    data?: EventData
  ): Promise<void> {
    return runWithSdkLogContext(async () => {
      if (this.hasWorkerEmitted) {
        console.warn(
          `Trying to emit event with event type: ${newEventType}. Ignoring emit request because it has already been emitted.`
        );
        return;
      }

      try {
        await this.beforeEmit(newEventType);
      } catch (error) {
        console.error('Error while preparing to emit event', error);
        parentPort?.postMessage(WorkerMessageSubject.WorkerMessageExit);
        this.hasWorkerEmitted = true;
        return;
      }

      // We want to save the state every time we emit an event, except for the start and delete events
      if (!STATELESS_EVENT_TYPES.includes(this.event.payload.event_type)) {
        console.log(
          `Saving state before emitting event with event type: ${newEventType}.`
        );

        try {
          await this.adapterState.postState();
        } catch (error) {
          console.error('Error while posting state', error);
          parentPort?.postMessage(WorkerMessageSubject.WorkerMessageExit);
          this.hasWorkerEmitted = true;
          return;
        }
      }

      try {
        // Always prune error messages to make them shorter before emit
        if (data?.error?.message) {
          data.error.message = truncateMessage(data.error.message);
        }

        await emit({
          eventType: newEventType,
          event: this.event,
          data: {
            ...data,
            ...this.buildEmitPayload(newEventType),
          },
        });

        const message: WorkerMessageEmitted = {
          subject: WorkerMessageSubject.WorkerMessageEmitted,
          payload: { eventType: newEventType },
        };
        this.afterEmit(newEventType);
        parentPort?.postMessage(message);
        this.hasWorkerEmitted = true;
      } catch (error) {
        console.error(
          `Error while emitting event with event type: ${newEventType}.`,
          serializeError(error)
        );
        parentPort?.postMessage(WorkerMessageSubject.WorkerMessageExit);
        this.hasWorkerEmitted = true;
      }
    });
  }
}
