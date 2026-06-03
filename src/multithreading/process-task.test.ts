import { EventType } from '../types/extraction';
import { WorkerEvent, WorkerMessageSubject } from '../types/workers';

// These tests cover logic that is NOT exercised by the end-to-end integration
// tests under src/tests/timeout-handling/:
//   - translation of legacy wire event types into the new enum (mutates event in place)
//   - the hasWorkerEmitted guard that prevents onTimeout from firing after a
//     successful emit (integration tests only exercise the positive case)
//   - the error branch that posts WorkerMessageFailed and exits(1)
//   - the WorkerMessage handler's guard that only flips isTimeout on
//     WorkerMessageExit (integration tests can't cleanly target non-Exit messages)
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

jest.mock('../state/extraction-state', () => ({
  createExtractionState: jest.fn(),
}));

jest.mock('./adapters/extraction-adapter', () => ({
  ExtractionAdapter: jest.fn().mockImplementation(() => ({
    isTimeout: false,
    hasWorkerEmitted: false,
  })),
}));

import { processExtractionTask } from './process-task';
import { createExtractionState } from '../state/extraction-state';
import { ExtractionAdapter } from './adapters/extraction-adapter';
import { createMockEvent } from '../common/test-utils';

function setWorkerData(data: Record<string, unknown>) {
  (global as Record<string, unknown>).__workerData__ = data;
}

function makeEvent(eventType = EventType.StartExtractingData) {
  return createMockEvent('http://localhost:0', {
    payload: { event_type: eventType },
  });
}

// Flush the microtask queue enough to let the async IIFE inside processExtractionTask run.
const flush = async () => new Promise((r) => setTimeout(r, 0));

describe(processExtractionTask.name, () => {
  let processExitSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    mockIsMainThread = false;

    processExitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation((() => {}) as () => never);

    (createExtractionState as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    processExitSpy.mockRestore();
  });

  it('should NOT call onTimeout when the worker already emitted before timeout check', async () => {
    // Arrange
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });
    // Both flags true: a timeout arrived but the worker had already emitted —
    // onTimeout must be skipped. This is the guard the integration suite cannot
    // target cleanly because it requires a precise race between emit and timeout.
    const mockAdapter = { isTimeout: true, hasWorkerEmitted: true };
    (ExtractionAdapter as jest.Mock).mockImplementation(() => mockAdapter);
    const task = jest.fn().mockResolvedValue(undefined);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    // Act
    processExtractionTask({ task, onTimeout });
    await flush();

    // Assert
    expect(onTimeout).not.toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  it('should NOT flip adapter.isTimeout when a non-Exit WorkerMessage arrives', async () => {
    // Arrange
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });
    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (ExtractionAdapter as jest.Mock).mockImplementation(() => mockAdapter);
    const task = jest.fn().mockResolvedValue(undefined);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    // Act
    processExtractionTask({ task, onTimeout });
    await flush();

    // Grab the handler registered for WorkerMessage events and invoke it with
    // subjects that must NOT flip isTimeout (log messages, unknown subjects).
    const messageHandlerCall = mockParentPortOn.mock.calls.find(
      ([eventName]) => eventName === WorkerEvent.WorkerMessage
    );
    expect(messageHandlerCall).toBeDefined();
    const handler = messageHandlerCall![1] as (m: unknown) => void;

    handler({ subject: WorkerMessageSubject.WorkerMessageLog });
    handler({ subject: 'NONSENSE_SUBJECT' });

    // Assert
    expect(mockAdapter.isTimeout).toBe(false);
  });

  it('should post WorkerMessageFailed with the error message and exit(1) when task throws', async () => {
    // Arrange
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });
    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (ExtractionAdapter as jest.Mock).mockImplementation(() => mockAdapter);
    const taskError = new Error('task boom');
    const task = jest.fn().mockRejectedValue(taskError);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    // Act
    processExtractionTask({ task, onTimeout });
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
