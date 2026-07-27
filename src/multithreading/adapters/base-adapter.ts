import { parentPort } from 'node:worker_threads';

import { STATELESS_EVENT_TYPES } from '../../common/constants';
import { serializeError, truncateMessage } from '../../logger/logger';
import { BaseState } from '../../state/state';
import { SdkState } from '../../state/state.interfaces';
import {
  AirSyncEvent,
  EventData,
  ExtractorEventType,
  WorkerMetadata,
} from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';
import {
  TaskResult,
  WorkerAdapterOptions,
  WorkerMessageEmitted,
  WorkerMessageSubject,
} from '../../types/workers';
import { Uploader } from '../../uploader/uploader';
import { emit } from '../emit';
import { getEventTypeForResult } from '../spawn/spawn.helpers';

/**
 * Shared state/behavior for both sync modes; owns the `emit` control-protocol
 * flow as a template method with mode-specific hooks.
 */
export abstract class BaseAdapter<ConnectorState> {
  readonly event: AirSyncEvent;
  readonly options?: WorkerAdapterOptions;
  hasWorkerEmitted: boolean;

  private _isTimeout: boolean = false;
  private resolveTimeoutSignal!: () => void;
  readonly timeoutSignal: Promise<void> = new Promise<void>((resolve) => {
    this.resolveTimeoutSignal = resolve;
  });

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
    this.uploader = new Uploader({
      event,
      options,
    });
  }

  get isTimeout(): boolean {
    return this._isTimeout;
  }

  set isTimeout(value: boolean) {
    this._isTimeout = value;
    if (value) {
      this.resolveTimeoutSignal();
    }
  }

  /** Connector-owned state exposed to snap-in code. */
  get state(): ConnectorState {
    return this.adapterState.state;
  }

  set state(value: ConnectorState) {
    this.adapterState.state = value;
  }

  /** SDK-internal bookkeeping state; not for connector use. */
  get sdkState(): SdkState {
    return this.adapterState.sdkState;
  }

  get extractionScope() {
    return this.adapterState.extractionScope;
  }

  async postState() {
    await this.adapterState.postState();
  }

  /** Pre-emit hook, runs before state is persisted. Throwing aborts the emit. */
  protected abstract beforeEmit(
    newEventType: ExtractorEventType | LoaderEventType
  ): Promise<void>;

  /** Mode-specific extras merged into the emitted event payload. */
  protected abstract buildEmitPayload(
    newEventType: ExtractorEventType | LoaderEventType
  ): EventData;

  /**
   * Mode-specific worker metadata merged into the emitted event. The library
   * version and state-date range are added centrally in `emit`, so subclasses
   * only contribute their own statistics.
   */
  protected buildWorkerMetadata(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    newEventType: ExtractorEventType | LoaderEventType
  ): WorkerMetadata | undefined {
    return undefined;
  }

  /** Post-emit hook, runs after the event has been sent successfully. */
  protected abstract afterEmit(
    newEventType: ExtractorEventType | LoaderEventType
  ): void;

  /**
   * Maps a {@link TaskResult} to the phase-appropriate platform event and emits
   * it exactly once. Invoked by the worker driver, not by connectors —
   * connectors signal outcomes by returning a `TaskResult`, never by emitting.
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

  protected async emit(
    newEventType: ExtractorEventType | LoaderEventType,
    data?: EventData
  ): Promise<void> {
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

    // Save state on every emit, except for start and delete events
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
        worker_metadata: this.buildWorkerMetadata(newEventType),
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
  }
}
