import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types/extraction';
import { createWorker } from './create-worker';

// Mock worker_threads module
jest.mock('node:worker_threads', () => ({
  isMainThread: true,
  Worker: jest.fn().mockImplementation(() => ({
    terminate: jest.fn(),
    on: jest.fn(),
  })),
}));

describe(createWorker.name, () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset to main thread by default
    const workerThreads = jest.requireMock('node:worker_threads');
    workerThreads.isMainThread = true;
  });

  it('should create a Worker instance when valid parameters are provided', async () => {
    const workerThreads = jest.requireMock('node:worker_threads');
    const mockOn = jest.fn();
    const mockWorkerInstance = {
      terminate: jest.fn(),
      on: mockOn,
    };
    workerThreads.Worker.mockReturnValue(mockWorkerInstance);

    const workerPath = __dirname + '../tests/dummy-worker.ts';

    const workerPromise = createWorker<object>({
      event: createEvent({
        eventType: EventType.ExtractionExternalSyncUnitsStart,
      }),
      initialState: {},
      workerPath,
    });

    // Simulate the worker going online
    const onlineCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'online'
    )?.[1];
    if (onlineCallback) {
      onlineCallback();
    }

    const worker = await workerPromise;

    expect(worker).not.toBeNull();
    expect(workerThreads.Worker).toHaveBeenCalled();
    await worker.terminate();
  });

  it('should throw error when not in main thread', async () => {
    const workerThreads = jest.requireMock('node:worker_threads');
    workerThreads.isMainThread = false;

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
  });

  it('[edge] should handle worker creation with minimal valid data', async () => {
    const workerThreads = jest.requireMock('node:worker_threads');
    const mockOn = jest.fn();
    const mockWorkerInstance = {
      terminate: jest.fn(),
      on: mockOn,
    };
    workerThreads.Worker.mockReturnValue(mockWorkerInstance);

    const workerPath = __dirname + '../tests/dummy-worker.ts';

    const workerPromise = createWorker<object>({
      event: createEvent({
        eventType: EventType.ExtractionExternalSyncUnitsStart,
      }),
      initialState: {},
      workerPath,
    });

    // Simulate the worker going online
    const onlineCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'online'
    )?.[1];
    if (onlineCallback) {
      onlineCallback();
    }

    const worker = await workerPromise;

    expect(workerThreads.Worker).toHaveBeenCalled();
    await worker.terminate();
  });

  it('[edge] should handle worker creation with complex initial state', async () => {
    const workerThreads = jest.requireMock('node:worker_threads');
    const mockOn = jest.fn();
    const mockWorkerInstance = {
      terminate: jest.fn(),
      on: mockOn,
    };
    workerThreads.Worker.mockReturnValue(mockWorkerInstance);

    const workerPath = __dirname + '../tests/dummy-worker.ts';
    const complexState = {
      nested: {
        data: [1, 2, 3],
        config: { enabled: true },
      },
    };

    const workerPromise = createWorker<typeof complexState>({
      event: createEvent({
        eventType: EventType.ExtractionDataStart,
      }),
      initialState: complexState,
      workerPath,
    });

    // Simulate the worker going online
    const onlineCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'online'
    )?.[1];
    if (onlineCallback) {
      onlineCallback();
    }

    const worker = await workerPromise;

    expect(workerThreads.Worker).toHaveBeenCalled();
    await worker.terminate();
  });

  it('[edge] should handle different event types', async () => {
    const workerThreads = jest.requireMock('node:worker_threads');
    const mockOn = jest.fn();
    const mockWorkerInstance = {
      terminate: jest.fn(),
      on: mockOn,
    };
    workerThreads.Worker.mockReturnValue(mockWorkerInstance);

    const workerPath = __dirname + '../tests/dummy-worker.ts';

    const workerPromise = createWorker<object>({
      event: createEvent({
        eventType: EventType.ExtractionMetadataStart,
      }),
      initialState: {},
      workerPath,
    });

    // Simulate the worker going online
    const onlineCallback = mockOn.mock.calls.find(
      (call) => call[0] === 'online'
    )?.[1];
    if (onlineCallback) {
      onlineCallback();
    }

    const worker = await workerPromise;

    expect(workerThreads.Worker).toHaveBeenCalled();
    await worker.terminate();
  });
});
