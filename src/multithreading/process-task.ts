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
        console.error('Error while processing task.', serializeError(error));
        process.exit(1);
      }
    });
  })();
}
