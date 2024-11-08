import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createAdapterState } from '../state/state';
import { WorkerAdapter } from './worker-adapter';
import {
  WorkerEvent,
  WorkerMessageDone,
  WorkerMessageSubject,
} from '../types/workers';
import { ProcessTaskInterface } from '../types/workers';
import { Logger } from '../logger/logger';

export function processTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<ConnectorState>) {
  if (!isMainThread) {
    (async () => {
      const event = workerData.event;
      const initialState = workerData.initialState as ConnectorState;
      const options = workerData.options;
      console = new Logger(event);

      const adapterState = await createAdapterState<ConnectorState>({
        event,
        initialState,
        options,
      });

      if (parentPort && workerData.event) {
        const adapter = new WorkerAdapter<ConnectorState>({
          event,
          adapterState,
          parentPort,
          options,
        });

        parentPort.on(WorkerEvent.WorkerMessage, async (message) => {
          if (message.subject === WorkerMessageSubject.WorkerMessageExit) {
            adapter.handleTimeout();
            await onTimeout({ adapter });
            process.exit(0);
          }
        });
        await task({ adapter });
        const message: WorkerMessageDone = {
          subject: WorkerMessageSubject.WorkerMessageDone,
        };
        parentPort.postMessage(message);
        process.exit(0);
      }
    })();
  }
}
