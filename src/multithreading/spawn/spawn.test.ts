import { EventEmitter } from 'events';
import { EventType } from '../../types/extraction';
import { WorkerEvent, WorkerMessageSubject } from '../../types/workers';
import { createMockEvent } from '../../common/test-utils';

/* eslint-disable @typescript-eslint/no-require-imports */

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('../create-worker', () => ({
  createWorker: jest.fn(),
}));

jest.mock('../../common/control-protocol', () => ({
  emit: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../logger/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    logFn: jest.fn(),
  })),
  serializeError: jest.fn((e: unknown) => String(e)),
}));

jest.mock('../../common/helpers', () => ({
  getLibraryVersion: jest.fn().mockReturnValue('1.0.0-test'),
  getMemoryUsage: jest.fn().mockReturnValue({
    formattedMessage: 'Memory: RSS 100/512MB (19.53%) [...]',
    rssUsedMB: '100.00',
    rssUsedPercent: '19.53%',
    heapUsedPercent: '30.00%',
    externalMB: '10.00',
    arrayBuffersMB: '5.00',
  }),
  sleep: jest.fn(),
  truncateFilename: jest.fn((f: string) => f),
  truncateMessage: jest.fn((m: string) => m),
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------
import { spawn, Spawn } from './spawn';
import { createWorker } from '../create-worker';
import { emit } from '../../common/control-protocol';
import { getMemoryUsage } from '../../common/helpers';

// ---------------------------------------------------------------------------
// Factory for a fake worker (EventEmitter with postMessage + terminate)
// ---------------------------------------------------------------------------
function makeWorker() {
  const w = new EventEmitter() as EventEmitter & {
    postMessage: jest.Mock;
    terminate: jest.Mock;
  };
  w.postMessage = jest.fn();
  w.terminate = jest.fn().mockResolvedValue(0);
  return w;
}

// ---------------------------------------------------------------------------
// Helper: instantiate Spawn directly, injecting a mock logger via console swap
// ---------------------------------------------------------------------------
function buildSpawn(overrides: {
  worker: ReturnType<typeof makeWorker>;
  options?: Record<string, unknown>;
  resolve?: () => void;
}): Spawn {
  const event = createMockEvent('http://localhost:0', {
    payload: { event_type: EventType.StartExtractingData },
  });
  const mockLogger = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    logFn: jest.fn(),
  };
  const originalConsole = console;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).console = mockLogger;
  const s = new Spawn({
    event,
    worker: overrides.worker as never,
    options: overrides.options as never,
    resolve: overrides.resolve ?? jest.fn(),
    originalConsole: originalConsole as Console,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (global as any).console = originalConsole;
  return s;
}

// ---------------------------------------------------------------------------
// spawn() factory tests
// ---------------------------------------------------------------------------

describe('spawn() factory', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: true });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should emit a no-script event and NOT spawn a worker for an unknown event type', async () => {
    const event = createMockEvent('http://localhost:0', {
      payload: { event_type: EventType.UnknownEventType },
    });

    await spawn({ event, initialState: {} });

    // No worker process should be started
    expect(createWorker).not.toHaveBeenCalled();
    // The platform should still receive a terminal event (so the run doesn't hang)
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({ event, eventType: expect.any(String) })
    );
  });

  it('should reject the returned promise when createWorker throws', async () => {
    (createWorker as jest.Mock).mockRejectedValue(new Error('worker boom'));

    const event = createMockEvent('http://localhost:0', {
      payload: { event_type: EventType.StartExtractingData },
    });

    await expect(
      spawn({ event, initialState: {}, workerPath: '/fake/path.js' })
    ).rejects.toThrow('worker boom');
  });
});

// ---------------------------------------------------------------------------
// Spawn class — lifecycle tests
// ---------------------------------------------------------------------------

describe('Spawn class', () => {
  let worker: ReturnType<typeof makeWorker>;
  let resolveMock: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers({ legacyFakeTimers: true });
    worker = makeWorker();
    resolveMock = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  // -------------------------------------------------------------------------
  // WorkerMessageFailed captured and propagated in error emit
  // -------------------------------------------------------------------------
  it('should include the WorkerMessageFailed reason in the error event emitted to the platform', async () => {
    buildSpawn({ worker, resolve: resolveMock });

    worker.emit(WorkerEvent.WorkerMessage, {
      subject: WorkerMessageSubject.WorkerMessageFailed,
      payload: { message: 'connector exploded' },
    });
    worker.emit(WorkerEvent.WorkerExit, 1);

    await Promise.resolve();
    await Promise.resolve();

    // The platform receives an error event whose message contains the reason
    // sent by the worker — this is what operators see in the run log.
    expect(emit).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error: expect.objectContaining({
            message: expect.stringContaining('connector exploded'),
          }),
        }),
      })
    );
    expect(resolveMock).toHaveBeenCalled();
  });

  it('should emit an error event when the worker exits without ever emitting', async () => {
    buildSpawn({ worker, resolve: resolveMock });

    worker.emit(WorkerEvent.WorkerExit, 1);

    await Promise.resolve();
    await Promise.resolve();

    expect(emit).toHaveBeenCalled();
    expect(resolveMock).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Soft timeout → posts WorkerMessageExit to worker
  // -------------------------------------------------------------------------
  it('should post WorkerMessageExit to the worker when soft timeout fires', async () => {
    buildSpawn({ worker, resolve: resolveMock });

    jest.advanceTimersByTime(600_001); // DEFAULT_LAMBDA_TIMEOUT = 10 min = 600 000 ms
    await Promise.resolve();

    expect(worker.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: WorkerMessageSubject.WorkerMessageExit,
      })
    );
  });

  // -------------------------------------------------------------------------
  // Hard timeout → terminates worker
  // -------------------------------------------------------------------------
  it('should call worker.terminate() when the hard timeout fires', async () => {
    buildSpawn({ worker, resolve: resolveMock });

    jest.advanceTimersByTime(780_001); // 600_000 * 1.3 = 780_000 ms
    await Promise.resolve();

    expect(worker.terminate).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Memory monitoring — error clears the interval
  // -------------------------------------------------------------------------
  it('should clear the memory monitoring interval when getMemoryUsage throws to prevent repeated crashes', async () => {
    (getMemoryUsage as jest.Mock).mockImplementation(() => {
      throw new Error('OOM');
    });

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    buildSpawn({ worker, resolve: resolveMock });

    jest.advanceTimersByTime(30_001); // MEMORY_LOG_INTERVAL = 30 s
    await Promise.resolve();

    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Soft-timeout race: worker emits AFTER softTimeoutSent — no double-emit
  // -------------------------------------------------------------------------
  it('should NOT emit an error when the worker successfully emits just after receiving the soft-timeout signal', async () => {
    buildSpawn({ worker, resolve: resolveMock });

    // Trigger soft timeout — sends WorkerMessageExit to the worker
    jest.advanceTimersByTime(600_001);
    await Promise.resolve();

    // Worker responds: emits its event successfully, then exits normally
    worker.emit(WorkerEvent.WorkerMessage, {
      subject: WorkerMessageSubject.WorkerMessageEmitted,
    });
    worker.emit(WorkerEvent.WorkerExit, 0);

    // The exit handler defers via setImmediate when softTimeoutSent=true
    jest.runAllImmediates();
    await Promise.resolve();
    await Promise.resolve();

    // No error should reach the platform — the worker completed its job
    const errorEmits = (emit as jest.Mock).mock.calls.filter(
      (call) => call[0]?.data?.error
    );
    expect(errorEmits).toHaveLength(0);
    expect(resolveMock).toHaveBeenCalled();
  });
});
