import { isMainThread, parentPort, workerData } from 'node:worker_threads';
import { createAdapterState } from '../state/state';
import { WorkerAdapter } from './worker-adapter';
import { WorkerEvent, WorkerMessageSubject } from '../types/workers';
import { ProcessTaskInterface } from '../types/workers';
import { Logger } from '../logger/logger';

export function processTask<ConnectorState>({
  task,
  onTimeout,
}: ProcessTaskInterface<ConnectorState>) {
  if (!isMainThread) {
    void (async () => {
      const event = workerData.event;
      const initialState = workerData.initialState as ConnectorState;
      const initialDomainMapping = workerData.initialDomainMapping;
      const options = workerData.options;
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

        parentPort.on(WorkerEvent.WorkerMessage, async (message) => {
          if (message.subject === WorkerMessageSubject.WorkerMessageExit) {
            adapter.handleTimeout();
            await onTimeout({ adapter });
            process.exit(0);
          }
        });
        await task({ adapter });
        process.exit(0);
      }
    })();
  }
}
