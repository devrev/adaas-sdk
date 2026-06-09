import { isMainThread, Worker } from 'node:worker_threads';

import { WorkerData, WorkerEvent } from '../types/workers';

/**
 * Creates a Node worker thread that runs the snap-in's task worker script.
 *
 * Used by `spawn` to launch the off-main-thread worker that processes an
 * extraction/loading event; the promise settles once the worker comes online
 * so the caller can wire up timeouts and lifecycle handling.
 *
 * @param workerData - The data of type WorkerData passed to the worker thread (event, initial state, options, etc.).
 * @returns A Promise that resolves with the online Worker instance, or rejects with the Error if the worker fails to start or is itself a worker thread.
 */
async function createWorker<ConnectorState>(
  workerData: WorkerData<ConnectorState>
): Promise<Worker> {
  return new Promise<Worker>((resolve, reject) => {
    if (isMainThread) {
      const workerFile = __dirname + '/worker.js';

      const worker: Worker = new Worker(workerFile, {
        workerData,
      } as WorkerOptions);

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
