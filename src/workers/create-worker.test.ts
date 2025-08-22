import { isMainThread, Worker } from 'worker_threads';

import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types/extraction';
import { createWorker } from './create-worker';

describe(createWorker.name, () => {
  it('should create a Worker instance when valid parameters are provided', async () => {
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

  it('should throw error when not in main thread', async () => {
    const originalIsMainThread = isMainThread;
    (isMainThread as any) = false;
    const workerPath = __dirname + '../tests/dummy-worker.ts';

    await expect(
      createWorker<object>({
        event: createEvent({
          eventType: EventType.ExtractionExternalSyncUnitsStart,
        }),
        initialState: {},
        workerPath,
      })
    ).rejects.toThrow('Worker threads can not start more worker threads.');

    // Restore original value
    (isMainThread as any) = originalIsMainThread;
  });

  it('[edge] should handle worker creation with minimal valid data', async () => {
      const workerPath = __dirname + '../tests/dummy-worker.ts';

      if (isMainThread) {
        const worker = await createWorker<object>({
          event: createEvent({
            eventType: EventType.ExtractionExternalSyncUnitsStart,
          }),
          initialState: {},
          workerPath,
        });

        expect(worker).toBeInstanceOf(Worker);
        await worker.terminate();
      }
    });

  it('[edge] should handle worker creation with complex initial state', async () => {
      const workerPath = __dirname + '../tests/dummy-worker.ts';
      const complexState = {
        nested: {
          data: [1, 2, 3],
          config: { enabled: true }
        }
      };

      if (isMainThread) {
        const worker = await createWorker<typeof complexState>({
          event: createEvent({
            eventType: EventType.ExtractionDataStart,
          }),
          initialState: complexState,
          workerPath,
        });

        expect(worker).toBeInstanceOf(Worker);
        await worker.terminate();
      }
    });

  it('[edge] should handle different event types', async () => {
      const workerPath = __dirname + '../tests/dummy-worker.ts';

      if (isMainThread) {
        const worker = await createWorker<object>({
          event: createEvent({
            eventType: EventType.ExtractionMetadataStart,
          }),
          initialState: {},
          workerPath,
        });

        expect(worker).toBeInstanceOf(Worker);
        await worker.terminate();
      }
    });
});
