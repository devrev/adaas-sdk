import { isMainThread, Worker } from 'worker_threads';

import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType } from '../types/extraction';
import { createWorker } from './create-worker';

describe(createWorker.name, () => {
  it('should create a Worker instance when valid parameters are provided', async () => {
    // Arrange
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingExternalSyncUnits },
    });

    // Act
    const worker = isMainThread
      ? await createWorker<object>({
          event,
          initialState: {},
          workerPath,
        })
      : null;

    // Assert
    expect(worker).not.toBeNull();
    expect(worker).toBeInstanceOf(Worker);

    if (worker) {
      await worker.terminate();
    }
  });

  it('should throw error when not in main thread', async () => {
    // Arrange
    const originalIsMainThread = isMainThread;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (isMainThread as any) = false;
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingExternalSyncUnits },
    });

    // Act & Assert
    await expect(
      createWorker<object>({
        event,
        initialState: {},
        workerPath,
      })
    ).rejects.toThrow('Worker threads can not start more worker threads.');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (isMainThread as any) = originalIsMainThread;
  });

  it('[edge] should handle worker creation with minimal valid data', async () => {
    // Arrange
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingExternalSyncUnits },
    });

    if (isMainThread) {
      // Act
      const worker = await createWorker<object>({
        event,
        initialState: {},
        workerPath,
      });

      // Assert
      expect(worker).toBeInstanceOf(Worker);
      await worker.terminate();
    }
  });

  it('[edge] should handle worker creation with complex initial state', async () => {
    // Arrange
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const complexState = {
      nested: {
        data: [1, 2, 3],
        config: { enabled: true },
      },
    };
    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingData },
    });

    if (isMainThread) {
      // Act
      const worker = await createWorker<typeof complexState>({
        event,
        initialState: complexState,
        workerPath,
      });

      // Assert
      expect(worker).toBeInstanceOf(Worker);
      await worker.terminate();
    }
  });

  it('[edge] should handle different event types', async () => {
    // Arrange
    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingMetadata },
    });

    if (isMainThread) {
      // Act
      const worker = await createWorker<object>({
        event,
        initialState: {},
        workerPath,
      });

      // Assert
      expect(worker).toBeInstanceOf(Worker);
      await worker.terminate();
    }
  });
});
