import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { translateIncomingEventType } from '../common/event-type-translation';
import { Logger, serializeError } from '../logger/logger';
import {
  runWithSdkLogContext,
  runWithUserLogContext,
} from '../logger/logger.context';
import { createAdapterState } from '../state/state';
import {
  ProcessTaskInterface,
  WorkerEvent,
  WorkerMessageSubject,
} from '../types/workers';
import { WorkerAdapter } from './worker-adapter/worker-adapter';

export function processTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<ConnectorState>) {
  if (isMainThread) {
    return;
  }

  void (async () => {
    await runWithSdkLogContext(async () => {
      let adapter: WorkerAdapter<ConnectorState> | undefined;

      try {
        const event = workerData.event;

        // TODO: Remove when the old types are completely phased out
        event.payload.event_type = translateIncomingEventType(
          event.payload.event_type
        );

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

        const workerAdapter = new WorkerAdapter<ConnectorState>({
          event,
          adapterState,
          options,
        });
        adapter = workerAdapter;

        parentPort?.on(WorkerEvent.WorkerMessage, (message) => {
          if (message.subject !== WorkerMessageSubject.WorkerMessageExit) {
            return;
          }
          console.log('Timeout received. Waiting for the task to finish.');
          workerAdapter.isTimeout = true;
        });

        console.log(
          'Event passsed from SDK to the connector:',
          workerAdapter.event
        );

        await runWithUserLogContext(async () =>
          task({ adapter: workerAdapter })
        );
        if (workerAdapter.isTimeout && !workerAdapter.hasWorkerEmitted) {
          await runWithUserLogContext(async () =>
            onTimeout({ adapter: workerAdapter })
          );
        }
        process.exit(0);
      } catch (error) {
        await runWithUserLogContext(async () => {
          if (adapter && !adapter.hasWorkerEmitted) {
            try {
              await adapter.emitError(error);
            } catch (failureError) {
              console.error(
                'Error while emitting task failure.',
                serializeError(failureError)
              );
            }
          }

          if (adapter?.hasWorkerEmitted) {
            process.exit(1);
            return;
          }

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
