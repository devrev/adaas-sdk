import { isMainThread, parentPort, workerData } from 'node:worker_threads';

import { Logger, serializeError } from '../logger/logger';
import { createExtractionState } from '../state/extraction-state';
import { createLoadingState } from '../state/loading-state';
import {
  ProcessTaskInterface,
  TaskResult,
  WorkerEvent,
  WorkerMessageSubject,
} from '../types/workers';

import { BaseAdapter } from './adapters/base-adapter';
import { ExtractionAdapter } from './adapters/extraction-adapter';
import { LoadingAdapter } from './adapters/loading-adapter';
import { getEventTypeForResult } from './spawn/spawn.helpers';

/**
 * Shared worker-thread driver: builds the adapter, runs the task, maps the
 * returned {@link TaskResult} to a platform event and emits it exactly once.
 * On soft timeout the timeout outcome always wins: the `onTimeout` result (or
 * a phase-appropriate default) is emitted and the task's return value is
 * ignored.
 */
async function runWorkerTask<Adapter extends BaseAdapter<unknown>>(
  buildAdapter: () => Promise<Adapter>,
  { task, onTimeout }: ProcessTaskInterface<Adapter>
): Promise<void> {
  try {
    const adapter = await buildAdapter();

    parentPort?.on(WorkerEvent.WorkerMessage, (message) => {
      if (message.subject !== WorkerMessageSubject.WorkerMessageExit) {
        return;
      }
      console.log('Timeout received. Waiting for the task to finish.');
      adapter.isTimeout = true;
    });

    let result: TaskResult = await task({ adapter });

    if (adapter.isTimeout) {
      if (onTimeout) {
        result = await onTimeout({ adapter });
      } else {
        // Non-resumable phases can't hand off with `progress`; report a timeout error.
        const eventType = adapter.event.payload.event_type;
        const { illegal } = getEventTypeForResult(eventType, 'progress');
        result = illegal
          ? {
              status: 'error',
              error: {
                message: `Worker timed out during a non-resumable phase (${eventType}), which cannot be continued.`,
              },
            }
          : { status: 'progress' };
      }
    }

    await adapter.emitFromResult(result);

    process.exit(0);
  } catch (error) {
    const errorMessage = `Error while processing task. ${serializeError(
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

/** Entry point for an extraction worker. @public */
export function processExtractionTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<ExtractionAdapter<ConnectorState>>) {
  if (isMainThread) {
    return;
  }

  void runWorkerTask<ExtractionAdapter<ConnectorState>>(
    async () => {
      const event = workerData.event;
      const initialState = workerData.initialState as ConnectorState;
      const initialDomainMapping = workerData.initialDomainMapping;
      const options = workerData.options;
      // eslint-disable-next-line no-global-assign
      console = new Logger({ event, options });

      const adapterState = await createExtractionState<ConnectorState>({
        event,
        initialState,
        initialDomainMapping,
        options,
      });

      return new ExtractionAdapter<ConnectorState>({
        event,
        adapterState,
        options,
      });
    },
    { task, onTimeout }
  );
}

/** Entry point for a loading worker. @public */
export function processLoadingTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<LoadingAdapter<ConnectorState>>) {
  if (isMainThread) {
    return;
  }

  void runWorkerTask<LoadingAdapter<ConnectorState>>(
    async () => {
      const event = workerData.event;
      const initialState = workerData.initialState as ConnectorState;
      const initialDomainMapping = workerData.initialDomainMapping;
      const options = workerData.options;
      // eslint-disable-next-line no-global-assign
      console = new Logger({ event, options });

      const adapterState = await createLoadingState<ConnectorState>({
        event,
        initialState,
        initialDomainMapping,
        options,
      });

      return new LoadingAdapter<ConnectorState>({
        event,
        adapterState,
        options,
      });
    },
    { task, onTimeout }
  );
}
