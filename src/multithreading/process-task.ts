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
  WorkerEvent,
  WorkerMessageSubject,
} from '../types/workers';

import { BaseAdapter } from './adapters/base-adapter';
import { ExtractionAdapter } from './adapters/extraction-adapter';
import { LoadingAdapter } from './adapters/loading-adapter';

/**
 * Shared worker-thread driver. Builds the logger context, runs the task and
 * (on timeout) the onTimeout callback against the provided adapter, and wires
 * the error/exit plumbing. The adapter is constructed by the caller so each
 * entry point can build its own typed adapter.
 */
async function runWorkerTask<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Adapter extends BaseAdapter<any, any>
>(
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

      await runWithUserLogContext(async () => task({ adapter }));
      if (adapter.isTimeout && !adapter.hasWorkerEmitted) {
        await runWithUserLogContext(async () => onTimeout({ adapter }));
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
