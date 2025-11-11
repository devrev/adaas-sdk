import { isMainThread, Worker } from 'node:worker_threads';

import { WorkerData, WorkerEvent } from '../types/workers';

async function createWorker<ConnectorState>(
  workerData: WorkerData<ConnectorState>
): Promise<Worker> {
  return new Promise<Worker>((resolve, reject) => {
    if (isMainThread) {
      const workerFile = __dirname + '/worker.js';

      const workerHeapSizeMb = workerData.options?.workerHeapSizeMb || 512;
      const maxOldGenerationSizeMb = Math.floor(workerHeapSizeMb / 1.2);
      const resourceLimits = {
        maxOldGenerationSizeMb,
      };

      const worker: Worker = new Worker(workerFile, {
        workerData,
        resourceLimits,
      });

      worker.on(WorkerEvent.WorkerError, (error) => {
        console.error('Worker error', error);
        reject(error);
      });
      worker.on(WorkerEvent.WorkerOnline, () => {
        resolve(worker);
        console.info(
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
