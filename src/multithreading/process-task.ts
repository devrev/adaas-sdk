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

async function handleTimeoutMessage<ConnectorState>(
  adapter: WorkerAdapter<ConnectorState>,
  taskPromise: Promise<void>,
  onTimeout: ProcessTaskInterface<ConnectorState>['onTimeout']
): Promise<void> {
  console.log('Timeout received. Setting flag and waiting for task to finish.');
  adapter.handleTimeout();

  try {
    await taskPromise;
  } catch (error) {
    console.warn('Task error during timeout:', serializeError(error));
  }

  console.log('Task finished. Running onTimeout.');
  await runWithUserLogContext(async () => onTimeout({ adapter }));
  console.log('Finished executing onTimeout function. Exiting worker.');
}

export function processTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<ConnectorState>) {
  if (!isMainThread) {
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

          if (!parentPort || !workerData.event) {
            return;
          }

          const adapter = new WorkerAdapter<ConnectorState>({
            event,
            adapterState,
            options,
          });

          // Track whether timeout was requested
          let timeoutRequested = false;
          let taskPromise: Promise<void>;

          // Set up message handler BEFORE starting task
          parentPort.on(WorkerEvent.WorkerMessage, (message) => {
            if (message.subject !== WorkerMessageSubject.WorkerMessageExit) {
              return;
            }

            timeoutRequested = true;
            void runWithSdkLogContext(async () => {
              try {
                await handleTimeoutMessage(adapter, taskPromise, onTimeout);
                process.exit(0);
              } catch (err) {
                console.error('Error in onTimeout:', serializeError(err));
                process.exit(1);
              }
            });
          });

          // Start task and store the promise
          taskPromise = runWithUserLogContext(async () => task({ adapter }));

          try {
            await taskPromise;
          } catch (error) {
            // If timeout was requested, let the timeout handler finish
            if (timeoutRequested) {
              console.log(
                'Task threw during timeout. Letting timeout handler finish.'
              );
              return;
            }
            throw error;
          }

          // Task completed normally
          if (!timeoutRequested) {
            console.log('Finished executing task. Exiting worker.');
            process.exit(0);
          }
          // If timeout was requested, the message handler will call process.exit
        } catch (error) {
          console.error('Error while processing task.', serializeError(error));
          process.exit(1);
        }
      });
    })();
  }
}
