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

        const adapter = new WorkerAdapter<ConnectorState>({
          event,
          adapterState,
          options,
        });

        // Start the task without awaiting so the timeout listener is registered in time.
        // If a timeout arrives mid-task, we let the task finish, then run onTimeout
        // (also triggered when the event data size limit is reached).
        const taskExecution: Promise<void> = runWithUserLogContext(async () =>
          task({ adapter })
        );
        parentPort?.on(WorkerEvent.WorkerMessage, async (message) => {
          if (message.subject !== WorkerMessageSubject.WorkerMessageExit) {
            return;
          }
          console.log('Timeout received. Waiting for the task to finish.');
          adapter.isTimeout = true;

          await taskExecution;
          await runWithUserLogContext(async () => onTimeout({ adapter }));
          process.exit(0);
        });

        await taskExecution;
        if (adapter.isTimeout) {
          await runWithUserLogContext(async () => onTimeout({ adapter }));
        }

        process.exit(0);
      } catch (error) {
        console.error('Error while processing task.', serializeError(error));
        process.exit(1);
      }
    });
  })();
}
