import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { Logger, serializeError } from '../logger/logger';
import {
  runWithSdkLogContext,
  runWithUserLogContext,
} from '../logger/logger.context';
import { createAdapterState } from '../state/state';
import { SyncMode } from '../types/common';
import {
  ProcessTaskInterface,
  WorkerAdapter,
  WorkerEvent,
  WorkerMessageSubject,
} from '../types/workers';
import { ExtractionAdapter } from './adapters/extraction-adapter';
import { LoadingAdapter } from './adapters/loading-adapter';

export function processTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<ConnectorState>) {
  if (isMainThread) {
    return;
  }

  void (async () => {
    await runWithSdkLogContext(async () => {
      try {
        const event = workerData.event;

        const initialState = workerData.initialState as ConnectorState;
        const initialDomainMapping = workerData.initialDomainMapping;
        const options = workerData.options;
        // eslint-disable-next-line no-global-assign
        console = new Logger({ event, options });

        const adapterState = await createAdapterState<ConnectorState>({
          event,
          initialState,
          initialDomainMapping,
          options,
        });

        const adapter: WorkerAdapter<ConnectorState> =
          event.payload.event_context.mode === SyncMode.LOADING
            ? new LoadingAdapter<ConnectorState>({
                event,
                adapterState,
                options,
              })
            : new ExtractionAdapter<ConnectorState>({
                event,
                adapterState,
                options,
              });

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
  })();
}
