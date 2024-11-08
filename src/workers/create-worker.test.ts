import { isMainThread, Worker } from 'worker_threads';

import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types/extraction';
import { createWorker } from './create-worker';

describe('createWorker function', () => {
  it('should return a Worker instance when a valid worker script is found', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const worker = isMainThread
      ? await createWorker<object>({
          event: createEvent({
            eventType: EventType.ExtractionExternalSyncUnitsStart,
          }),
          initialState: {},
          workerPath,
        })
      : null;

    expect(worker).not.toBeNull();
    expect(worker).toBeInstanceOf(Worker);

    if (worker) {
      await worker.terminate();
    }
  });
});
