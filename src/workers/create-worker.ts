import { isMainThread, Worker } from 'node:worker_threads';

import { WorkerData, WorkerEvent } from '../types/workers';
import { Logger, serializeError } from '../logger/logger';

async function createWorker<ConnectorState>(
  workerData: WorkerData<ConnectorState>
): Promise<Worker> {
  return new Promise<Worker>((resolve, reject) => {
    if (isMainThread) {
      const logger = new Logger({
        event: workerData.event,
        options: workerData.options,
      });
      const workerFile = __dirname + '/worker.js';

      const worker: Worker = new Worker(workerFile, {
        workerData,
      } as WorkerOptions);

      worker.on(WorkerEvent.WorkerError, (error) => {
        logger.error('Worker error', serializeError(error));
        reject();
      });
      worker.on(WorkerEvent.WorkerOnline, () => {
        resolve(worker);
        logger.info(
          'Worker is online. Started processing the task with event type: ' +
            workerData.event.payload.event_type +
            '.'
        );
      });
    } else {
      reject(new Error('Worker threads can not start more worker threads.'));
    }
  });
}

export { createWorker };
