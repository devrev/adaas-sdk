import { EventType } from '../types/extraction';
import { WorkerMessageSubject } from '../types/workers';

/* eslint-disable @typescript-eslint/no-require-imports */

// ---------------------------------------------------------------------------
// Module mocks – all must be declared before any imports that trigger them
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------
import { processTask } from './process-task';
import { translateIncomingEventType } from '../common/event-type-translation';
import { createAdapterState } from '../state/state';
import { WorkerAdapter } from './worker-adapter/worker-adapter';
import { createMockEvent } from '../common/test-utils';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function setWorkerData(data: Record<string, unknown>) {
  (global as Record<string, unknown>).__workerData__ = data;
}

function makeEvent(eventType = EventType.StartExtractingData) {
  return createMockEvent('http://localhost:0', {
    payload: { event_type: eventType },
  });
}

// Flush the microtask queue enough to let the async IIFE inside processTask run
const flush = () => new Promise((r) => setTimeout(r, 0));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('processTask', () => {
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

  // -------------------------------------------------------------------------
  it('should return early when running on the main thread', () => {
    mockIsMainThread = true;
    const task = jest.fn();
    const onTimeout = jest.fn();

    processTask({ task, onTimeout });

    expect(task).not.toHaveBeenCalled();
    expect(onTimeout).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  it('should translate incoming event type before passing to task', async () => {
    const event = makeEvent(EventType.StartExtractingData);
    setWorkerData({ event, initialState: {}, options: {} });

    (translateIncomingEventType as jest.Mock).mockReturnValue(
      EventType.StartExtractingMetadata
    );

    const task = jest.fn().mockResolvedValue(undefined);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    processTask({ task, onTimeout });
    await flush();

    expect(translateIncomingEventType).toHaveBeenCalledWith(
      EventType.StartExtractingData
    );
    // The event is mutated in place — downstream code (including task) sees the
    // translated type, not the original wire type.
    expect(event.payload.event_type).toBe(EventType.StartExtractingMetadata);
  });

  // -------------------------------------------------------------------------
  it('should call task with the adapter on the happy path and exit(0)', async () => {
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });

    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);

    const task = jest.fn().mockResolvedValue(undefined);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    processTask({ task, onTimeout });
    await flush();

    expect(task).toHaveBeenCalledWith({ adapter: mockAdapter });
    expect(onTimeout).not.toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  // -------------------------------------------------------------------------
  it('should call onTimeout after task finishes when a WorkerMessageExit arrives mid-task', async () => {
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });

    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);

    // Capture the handler that processTask registers via parentPort.on so we
    // can fire it ourselves at the right moment — after registration but
    // before the task resolves.
    let registeredHandler: ((msg: { subject: string }) => void) | null = null;
    mockParentPortOn.mockImplementation(
      (_event: string, cb: (msg: { subject: string }) => void) => {
        registeredHandler = cb;
      }
    );

    const task = jest.fn().mockImplementation(async () => {
      // At this point the handler is already registered.  Simulate the main
      // thread sending WorkerMessageExit while the task is running.
      expect(registeredHandler).not.toBeNull();
      registeredHandler!({ subject: WorkerMessageSubject.WorkerMessageExit });
      // isTimeout is now true (set by the production handler), hasWorkerEmitted
      // is still false — onTimeout should be called after this returns.
    });
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    processTask({ task, onTimeout });
    await flush();

    expect(onTimeout).toHaveBeenCalledWith({ adapter: mockAdapter });
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  // -------------------------------------------------------------------------
  it('should NOT call onTimeout when the worker already emitted before timeout check', async () => {
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });

    // Both flags true: a timeout arrived but the worker had already emitted —
    // onTimeout must be skipped.
    const mockAdapter = { isTimeout: true, hasWorkerEmitted: true };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);

    const task = jest.fn().mockResolvedValue(undefined);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    processTask({ task, onTimeout });
    await flush();

    expect(onTimeout).not.toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });

  // -------------------------------------------------------------------------
  it('should post WorkerMessageFailed with the error message and exit(1) when task throws', async () => {
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });

    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);

    const taskError = new Error('task boom');
    const task = jest.fn().mockRejectedValue(taskError);
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    processTask({ task, onTimeout });
    await flush();

    expect(mockParentPortPostMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: WorkerMessageSubject.WorkerMessageFailed,
        payload: expect.objectContaining({
          message: expect.stringContaining('task boom'),
        }),
      })
    );
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  // -------------------------------------------------------------------------
  it('should not call onTimeout when task throws', async () => {
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });

    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);

    const task = jest.fn().mockRejectedValue(new Error('fail'));
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    processTask({ task, onTimeout });
    await flush();

    expect(onTimeout).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  it('should ignore non-exit worker messages — WorkerMessageLog does not set isTimeout', async () => {
    const event = makeEvent();
    setWorkerData({ event, initialState: {}, options: {} });

    const mockAdapter = { isTimeout: false, hasWorkerEmitted: false };
    (WorkerAdapter as jest.Mock).mockImplementation(() => mockAdapter);

    let registeredHandler: ((msg: { subject: string }) => void) | null = null;
    mockParentPortOn.mockImplementation(
      (_event: string, cb: (msg: { subject: string }) => void) => {
        registeredHandler = cb;
      }
    );

    const task = jest.fn().mockImplementation(async () => {
      // Fire a WorkerMessageLog — should be a no-op for isTimeout
      registeredHandler!({ subject: WorkerMessageSubject.WorkerMessageLog });
    });
    const onTimeout = jest.fn().mockResolvedValue(undefined);

    processTask({ task, onTimeout });
    await flush();

    expect(mockAdapter.isTimeout).toBe(false);
    expect(onTimeout).not.toHaveBeenCalled();
    expect(processExitSpy).toHaveBeenCalledWith(0);
  });
});
