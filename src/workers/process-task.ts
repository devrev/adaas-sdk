import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { translateIncomingEventType } from '../common/event-type-translation';
import { Logger, serializeError } from '../logger/logger';
import { createAdapterState } from '../state/state';
import {
  ProcessTaskInterface,
  WorkerEvent,
  WorkerMessageSubject,
} from '../types/workers';
import { WorkerAdapter } from './worker-adapter';

export function processTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<ConnectorState>) {
  if (!isMainThread) {
    void (async () => {
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

        if (parentPort && workerData.event) {
          const adapter = new WorkerAdapter<ConnectorState>({
            event,
            adapterState,
            options,
          });

          parentPort.on(
            WorkerEvent.WorkerMessage,
            (message) =>
              void (async () => {
                if (
                  message.subject === WorkerMessageSubject.WorkerMessageExit
                ) {
                  console.log(
                    'Worker received message to gracefully exit. Setting isTimeout flag and executing onTimeout function.'
                  );

                  adapter.handleTimeout();
                  await onTimeout({ adapter });

                  console.log(
                    'Finished executing onTimeout function. Exiting worker.'
                  );
                  process.exit(0);
                }
              })()
          );
          await task({ adapter });

          // If size limit was triggered during task, call onTimeout for cleanup
          if (adapter.isTimeout) {
            console.log(
              '[SIZE_LIMIT] Size limit detected during data collection. Executing onTimeout function for cleanup.'
            );
            await onTimeout({ adapter });
          }

          process.exit(0);
        }
      } catch (error) {
        console.error('Error while processing task.', serializeError(error));
        process.exit(1);
      }
    })();
  }
}
