import { EventType } from '../types/extraction';
import { WorkerMessageSubject } from '../types/workers';

// These tests cover logic that is NOT exercised by the end-to-end integration
// tests under src/tests/timeout-handling/:
//   - translation of legacy wire event types into the new enum (mutates event in place)
//   - the hasWorkerEmitted guard that prevents onTimeout from firing after a
//     successful emit (integration tests only exercise the positive case)
//   - the error branch that posts WorkerMessageFailed and exits(1)
//
// Tests for the happy path, timeout-signal-reaches-worker behavior, and main-thread
// early return were removed — they either duplicate what the integration suite
// already exercises or assert mocked behavior with little signal.

const mockParentPortPostMessage = jest.fn();
const mockParentPortOn = jest.fn();

let mockIsMainThread = false;

jest.mock('node:worker_threads', () => ({
  get isMainThread() {
    return mockIsMainThread;
  },
  get parentPort() {
    return {
      postMessage: mockParentPortPostMessage,
      on: mockParentPortOn,
    };
  },
  get workerData() {
    return (global as Record<string, unknown>).__workerData__ ?? {};
  },
}));

jest.mock('../common/event-type-translation', () => ({
  translateIncomingEventType: jest.fn((t: string) => t),
}));

jest.mock('../logger/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    logFn: jest.fn(),
  })),
  serializeError: jest.fn((e: unknown) => String(e)),
}));

jest.mock('../logger/logger.context', () => ({
  runWithSdkLogContext: jest.fn((fn: () => unknown) => fn()),
  runWithUserLogContext: jest.fn((fn: () => unknown) => fn()),
}));

jest.mock('../state/state', () => ({
  createAdapterState: jest.fn(),
}));

jest.mock('./worker-adapter/worker-adapter', () => ({
  WorkerAdapter: jest.fn().mockImplementation(() => ({
    isTimeout: false,
    hasWorkerEmitted: false,
  })),
}));

import { processTask } from './process-task';
import { translateIncomingEventType } from '../common/event-type-translation';
import { createAdapterState } from '../state/state';
import { WorkerAdapter } from './worker-adapter/worker-adapter';
import { createMockEvent } from '../common/test-utils';

function setWorkerData(data: Record<string, unknown>) {
  (global as Record<string, unknown>).__workerData__ = data;
}

function makeEvent(eventType = EventType.StartExtractingData) {
  return createMockEvent('http://localhost:0', {
    payload: { event_type: eventType },
  });
}

// Flush the microtask queue enough to let the async IIFE inside processTask run.
const flush = async () => new Promise((r) => setTimeout(r, 0));

describe(processTask.name, () => {
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMainThread = false;

    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as () => never);

    (createAdapterState as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  it('should translate incoming event type before passing to task', async () => {
    // Arrange
    const event = makeEvent(EventType.StartExtractingData);
    setWorkerData({ event, initialState: {}, options: {} });
    (translateIncomingEventType as jest.Mock).mockReturnValue(
      EventType.StartExtractingMetadata
    );
    const task = jest.fn().mockResolvedValue(undefined);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    // Act
    processTask({ task, onTimeout });
    await flush();

    // Assert
    expect(translateIncomingEventType).toHaveBeenCalledWith(
      EventType.StartExtractingData
    );
    // The event is mutated in place — downstream code (including task) sees the
    // translated type, not the original wire type.
    expect(event.payload.event_type).toBe(EventType.StartExtractingMetadata);
  });

  it('should NOT call onTimeout when the worker already emitted before timeout check', async () => {
    // Arrange
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });
    // Both flags true: a timeout arrived but the worker had already emitted —
    // onTimeout must be skipped. This is the guard the integration suite cannot
    // target cleanly because it requires a precise race between emit and timeout.
    const mockAdapter = { isTimeout: true, hasWorkerEmitted: true };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);
    const task = jest.fn().mockResolvedValue(undefined);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    // Act
    processTask({ task, onTimeout });
    await flush();

    // Assert
    expect(onTimeout).not.toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should post WorkerMessageFailed with the error message and exit(1) when task throws', async () => {
    // Arrange
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });
    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);
    const taskError = new Error('task boom');
    const task = jest.fn().mockRejectedValue(taskError);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    // Act
    processTask({ task, onTimeout });
    await flush();

    // Assert
    expect(mockParentPortPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: WorkerMessageSubject.WorkerMessageFailed,
        payload: expect.objectContaining({
          message: expect.stringContaining('task boom'),
        }),
      })
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(onTimeout).not.toHaveBeenCalled();
  });
});
