import { isMainThread, Worker } from 'worker_threads';

import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types/extraction';
import { createWorker, CreateWorkerResult } from './create-worker';

describe(createWorker.name, () => {
  it('should create a Worker instance when valid parameters are provided', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';

    const result: CreateWorkerResult | null = isMainThread
      ? await createWorker<object>({
          event: createEvent({
            eventType: EventType.ExtractionExternalSyncUnitsStart,
          }),
          initialState: {},
          workerPath,
        })
      : null;

    expect(result).not.toBeNull();
    expect(result?.worker).toBeInstanceOf(Worker);
    expect(result?.memoryConfig).toBeDefined();
    expect(result?.resourceLimits).toBeDefined();

    if (result) {
      await result.worker.terminate();
    }
  });

  it('should throw error when not in main thread', async () => {
    const originalIsMainThread = isMainThread;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (isMainThread as any) = originalIsMainThread;
  });

  it('[edge] should handle worker creation with minimal valid data', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';

    if (isMainThread) {
      const result = await createWorker<object>({
        event: createEvent({
          eventType: EventType.ExtractionExternalSyncUnitsStart,
        }),
        initialState: {},
        workerPath,
      });

      expect(result.worker).toBeInstanceOf(Worker);
      await result.worker.terminate();
    }
  });

  it('[edge] should handle worker creation with complex initial state', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const complexState = {
      nested: {
        data: [1, 2, 3],
        config: { enabled: true },
      },
    };

    if (isMainThread) {
      const result = await createWorker<typeof complexState>({
        event: createEvent({
          eventType: EventType.ExtractionDataStart,
        }),
        initialState: complexState,
        workerPath,
      });

      expect(result.worker).toBeInstanceOf(Worker);
      await result.worker.terminate();
    }
  });

  it('[edge] should handle different event types', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';

    if (isMainThread) {
      const result = await createWorker<object>({
        event: createEvent({
          eventType: EventType.ExtractionMetadataStart,
        }),
        initialState: {},
        workerPath,
      });

      expect(result.worker).toBeInstanceOf(Worker);
      await result.worker.terminate();
    }
  });

  it('should include memory configuration in result', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';

    if (isMainThread) {
      const result = await createWorker<object>({
        event: createEvent({
          eventType: EventType.ExtractionExternalSyncUnitsStart,
        }),
        initialState: {},
        workerPath,
      });

      expect(result.memoryConfig).toHaveProperty('maxOldGenerationSizeMb');
      expect(result.memoryConfig).toHaveProperty('totalAvailableMemoryMb');
      expect(result.memoryConfig).toHaveProperty('isLambda');
      expect(result.memoryConfig).toHaveProperty('isLocalDevelopment');
      expect(result.resourceLimits).toHaveProperty('maxOldGenerationSizeMb');

      await result.worker.terminate();
    }
  });

  it('should apply testMemoryLimitMb override when provided', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const testMemoryLimit = 64;

    if (isMainThread) {
      const result = await createWorker<object>({
        event: createEvent({
          eventType: EventType.ExtractionExternalSyncUnitsStart,
        }),
        initialState: {},
        workerPath,
        options: {
          testMemoryLimitMb: testMemoryLimit,
        },
      });

      expect(result.resourceLimits.maxOldGenerationSizeMb).toBe(testMemoryLimit);

      await result.worker.terminate();
    }
  });

  it('should create worker without memory limits when enableMemoryLimits is false', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';

    if (isMainThread) {
      const result = await createWorker<object>({
        event: createEvent({
          eventType: EventType.ExtractionExternalSyncUnitsStart,
        }),
        initialState: {},
        workerPath,
        options: {
          enableMemoryLimits: false,
        },
      });

      // Worker should still be created successfully
      expect(result.worker).toBeInstanceOf(Worker);
      // Memory config should still be calculated (for logging purposes)
      expect(result.memoryConfig).toBeDefined();
      expect(result.resourceLimits).toBeDefined();

      await result.worker.terminate();
    }
  });

  it('should set isLocalDevelopment in memory config when option is provided', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';

    if (isMainThread) {
      const result = await createWorker<object>({
        event: createEvent({
          eventType: EventType.ExtractionExternalSyncUnitsStart,
        }),
        initialState: {},
        workerPath,
        options: {
          isLocalDevelopment: true,
        },
      });

      expect(result.memoryConfig.isLocalDevelopment).toBe(true);

      await result.worker.terminate();
    }
  });

  it('[edge] should handle all extraction event types', async () => {
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const eventTypes = [
      EventType.ExtractionExternalSyncUnitsStart,
      EventType.ExtractionMetadataStart,
      EventType.ExtractionDataStart,
      EventType.ExtractionDataContinue,
      EventType.ExtractionAttachmentsStart,
      EventType.ExtractionAttachmentsContinue,
    ];

    if (isMainThread) {
      for (const eventType of eventTypes) {
        const result = await createWorker<object>({
          event: createEvent({ eventType }),
          initialState: {},
          workerPath,
        });

        expect(result.worker).toBeInstanceOf(Worker);
        expect(result.memoryConfig).toBeDefined();

        await result.worker.terminate();
      }
    }
  });
});
