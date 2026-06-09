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
  TaskResult,
  WorkerAdapterOptions,
  WorkerMessageEmitted,
  WorkerMessageSubject,
} from '../../types/workers';
import { Uploader } from '../../uploader/uploader';
import { getEventTypeForResult } from '../spawn/spawn.helpers';

/**
 * Abstract base for the worker adapters, holding state and behavior shared by
 * both sync modes and owning the `emit` control-protocol flow as a template method.
 *
 * Used as the type passed to worker tasks; mode-specific adapters
 * (`ExtractionAdapter`, `LoadingAdapter`) extend it and implement the abstract
 * hooks (`beforeEmit`, `buildEmitPayload`, `afterEmit`) to inject their own
 * pre-emit work and event payload shaping.
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

  /** Per-item-type extraction scope (which item types to extract). */
  get extractionScope() {
    return this.adapterState.extractionScope;
  }

  /**
   * Persists the current adapter state to the platform.
   *
   * Used to checkpoint connector and SDK state outside of an emit.
   *
   * @returns Promise that resolves once the state has been posted.
   */
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
   * Maps a {@link TaskResult} returned by a worker's task/onTimeout callback to
   * the phase-appropriate platform event and emits it exactly once.
   *
   * Used as the SDK-internal bridge between the return-based connector contract
   * and the control protocol; it is invoked by the worker driver, not by
   * connectors. Connectors signal outcomes by returning a `TaskResult`, never by
   * calling `emit` directly. A `delay`/`error` status carries its delay seconds
   * or error into the event data; a status that is illegal for a non-resumable
   * phase is downgraded to an error event.
   *
   * @param result - The TaskResult status the worker reported for the current phase.
   * @returns Promise that resolves once the mapped event has been emitted.
   */
  async emitFromResult(result: TaskResult): Promise<void> {
    const { eventType, illegal } = getEventTypeForResult(
      this.event.payload.event_type,
      result.status
    );

    const data: EventData = {};
    if (result.status === 'delay') {
      data.delay = result.delaySeconds;
    } else if (result.status === 'error') {
      data.error = result.error;
    } else if (illegal) {
      data.error = {
        message: `Worker returned status '${result.status}' for a non-resumable phase (${this.event.payload.event_type}), which is not allowed. Emitting an error event instead.`,
      };
    }

    await this.emit(eventType, data);
  }

  /**
   * Emits a single event to the platform via the template-method flow.
   *
   * Used as the one place that sends a control-protocol event: it runs the
   * `beforeEmit` hook, persists state (except for stateless start/delete events),
   * merges in the mode-specific `buildEmitPayload`, sends the event, then runs
   * `afterEmit`. Guarded by `hasWorkerEmitted` so it emits at most once; any
   * failure in preparation, state posting, or sending signals the worker to exit.
   *
   * @param newEventType - The ExtractorEventType or LoaderEventType to emit.
   * @param data - Optional EventData (e.g. delay or error) merged into the payload.
   * @returns Promise that resolves once the emit attempt has completed.
   */
  protected async emit(
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
