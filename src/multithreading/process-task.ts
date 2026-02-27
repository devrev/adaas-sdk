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

        // Timeout handling flow:
        // The task() runs in the main flow below. Meanwhile, the parent thread may send
        // a timeout message at any point. When that happens, the message handler signals
        // the adapter to stop (handleTimeout), waits for task() to finish, then runs onTimeout().
        // If task() completes before any timeout message arrives, the worker exits normally.
        // isTimeoutReceived prevents both flows from calling process.exit.
        let isTimeoutReceived = false;
        const taskExecution: Promise<void> = runWithUserLogContext(async () =>
          task({ adapter })
        );
        parentPort?.on(WorkerEvent.WorkerMessage, (message) => {
          if (message.subject !== WorkerMessageSubject.WorkerMessageExit) {
            return;
          }

          isTimeoutReceived = true;

          void runWithSdkLogContext(async () => {
            try {
              console.log('Timeout received. Waiting for the task to finish.');
              adapter.handleTimeout();

              try {
                await taskExecution;
              } catch (taskError) {
                console.warn(
                  'Task error during timeout:',
                  serializeError(taskError)
                );
              }

              console.log('Task finished. Running onTimeout handler.');
              await runWithUserLogContext(async () => onTimeout({ adapter }));
              console.log('onTimeout handler complete. Exiting worker.');
              process.exit(0);
            } catch (onTimeoutError) {
              console.error(
                'Error in onTimeout handler:',
                serializeError(onTimeoutError)
              );
              process.exit(1);
            }
          });
        });

        try {
          await taskExecution;
        } catch (taskError) {
          if (isTimeoutReceived) {
            console.log(
              'Task threw during timeout. Letting timeout handler finish.'
            );
            return;
          }
          throw taskError;
        }

        if (!isTimeoutReceived) {
          console.log('Task completed. Exiting worker.');
          process.exit(0);
        }
      } catch (error) {
        console.error('Error while processing task.', serializeError(error));
        process.exit(1);
      }
    });
  })();
}
