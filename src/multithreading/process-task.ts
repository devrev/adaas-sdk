import { isMainThread, parentPort, workerData } from 'node:worker_threads';

import { Logger, serializeError } from '../logger/logger';
import {
  runWithSdkLogContext,
  runWithUserLogContext,
} from '../logger/logger.context';
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

/**
 * Shared worker-thread driver. Builds the logger context, runs the task and
 * (on timeout) the onTimeout callback against the provided adapter, maps the
 * returned {@link TaskResult} to a platform event and emits it exactly once,
 * and wires the error/exit plumbing.
 *
 * The adapter is constructed by the caller so each entry point can build its
 * own typed adapter.
 *
 * If `onTimeout` is omitted, the SDK emits a phase-appropriate default on
 * timeout: `progress` (resumable phases) or `error` (non-resumable phases) is
 * handled by the status->event mapping when we emit a `progress` result.
 *
 * @param buildAdapter - Factory that constructs the typed adapter for this worker.
 * @param params - The task hooks of type ProcessTaskInterface.
 * @param params.task - The worker's main task; receives the adapter and resolves to a TaskResult.
 * @param params.onTimeout - Optional callback run on soft timeout when nothing has emitted yet; resolves to a TaskResult.
 * @returns A Promise that resolves once the result has been emitted and the worker process exits.
 */
async function runWorkerTask<Adapter extends BaseAdapter<unknown>>(
  buildAdapter: () => Promise<Adapter>,
  { task, onTimeout }: ProcessTaskInterface<Adapter>
): Promise<void> {
  await runWithSdkLogContext(async () => {
    try {
      const adapter = await buildAdapter();

      parentPort?.on(WorkerEvent.WorkerMessage, (message) => {
        if (message.subject !== WorkerMessageSubject.WorkerMessageExit) {
          return;
        }
        console.log('Timeout received. Waiting for the task to finish.');
        adapter.isTimeout = true;
      });

      let result: TaskResult = await runWithUserLogContext(async () =>
        task({ adapter })
      );

      // On timeout, hand off to onTimeout (or default to a progress result).
      if (adapter.isTimeout && !adapter.hasWorkerEmitted) {
        result = onTimeout
          ? await runWithUserLogContext(async () => onTimeout({ adapter }))
          : { status: 'progress' };
      }

      if (!adapter.hasWorkerEmitted) {
        await adapter.emitFromResult(result);
      }

      process.exit(0);
    } catch (error) {
      runWithUserLogContext(() => {
        const errorMessage = `Error while processing task. ${serializeError(
          error
        )}`;
        console.error(errorMessage);
        parentPort?.postMessage({
          subject: WorkerMessageSubject.WorkerMessageFailed,
          payload: { message: errorMessage },
        });
        process.exit(1);
      });
    }
  });
}

/**
 * Entry point for an extraction worker. Builds an {@link ExtractionAdapter} and
 * runs the provided task against it.
 *
 * Used as the worker-script entry the snap-in calls inside an extraction worker
 * thread; returns immediately on the main thread so the same module can be
 * imported there safely.
 *
 * @param params - The task hooks of type ProcessTaskInterface for an ExtractionAdapter.
 * @param params.task - The extraction task; receives the adapter and resolves to a TaskResult.
 * @param params.onTimeout - Optional callback run on soft timeout; resolves to a TaskResult.
 * @returns Nothing; emission and process exit are handled by the shared driver.
 *
 * @public
 */
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

/**
 * Entry point for a loading worker. Builds a {@link LoadingAdapter} and runs the
 * provided task against it.
 *
 * Used as the worker-script entry the snap-in calls inside a loading worker
 * thread; returns immediately on the main thread so the same module can be
 * imported there safely.
 *
 * @param params - The task hooks of type ProcessTaskInterface for a LoadingAdapter.
 * @param params.task - The loading task; receives the adapter and resolves to a TaskResult.
 * @param params.onTimeout - Optional callback run on soft timeout; resolves to a TaskResult.
 * @returns Nothing; emission and process exit are handled by the shared driver.
 *
 * @public
 */
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
