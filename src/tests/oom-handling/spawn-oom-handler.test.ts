import { EventEmitter } from 'node:events';

import { emit } from '../../common/control-protocol';
import { EventType } from '../../types/extraction';
import { WorkerEvent } from '../../types/workers';
import { Spawn } from '../../workers/spawn';
import { createEvent } from '../test-helpers';

jest.mock('../../common/control-protocol', () => ({
  emit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../logger/logger', () => ({
  Logger: class MockLogger {
    logFn = jest.fn();
  },
  serializeError: (value: unknown) => value,
}));

function createSpawnInstance() {
  class StubWorker extends EventEmitter {
    postMessage = jest.fn();
    terminate = jest.fn().mockResolvedValue(undefined);
  }

  const worker = new StubWorker();
  const resolve = jest.fn();
  const event = createEvent({ eventType: EventType.ExtractionDataStart });
  const spawnInstance = new Spawn({
    event,
    worker: worker as never,
    options: { timeout: 60_000 },
    resolve,
    originalConsole: console,
  });

  return { worker, spawnInstance, resolve } as const;
}

async function flushMicrotasks() {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('Spawn OOM handling', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('emits a single OOM error when worker crashes with heap message', async () => {
    const { worker, spawnInstance, resolve } = createSpawnInstance();

    worker.emit(
      WorkerEvent.WorkerError,
      new Error('JavaScript heap out of memory')
    );
    await flushMicrotasks();

    expect(emit).toHaveBeenCalledTimes(1);
    const payload = (emit as jest.Mock).mock.calls[0][0];
    expect(payload.data.error.message).toContain(
      'Worker exceeded memory limit'
    );
    expect(resolve).toHaveBeenCalled();

    (spawnInstance as unknown as { clearTimeouts: () => void }).clearTimeouts();
  });

  it('falls back to standard exit flow for non-OOM errors', async () => {
    const { worker, spawnInstance } = createSpawnInstance();

    worker.emit(WorkerEvent.WorkerError, new Error('Unexpected failure'));
    await flushMicrotasks();

    expect(emit).toHaveBeenCalledTimes(1);
    const payload = (emit as jest.Mock).mock.calls[0][0];
    expect(payload.data.error.message).toContain('Worker exited the process');

    (spawnInstance as unknown as { clearTimeouts: () => void }).clearTimeouts();
  });

  it('does not emit twice when an OOM occurs after an event was already sent', async () => {
    const { worker, spawnInstance } = createSpawnInstance();

    (spawnInstance as unknown as { alreadyEmitted: boolean }).alreadyEmitted =
      true;
    worker.emit(WorkerEvent.WorkerError, new Error('out of memory'));
    await flushMicrotasks();

    expect(emit).not.toHaveBeenCalled();

    (spawnInstance as unknown as { clearTimeouts: () => void }).clearTimeouts();
  });

  it('emits the default exit error when the worker exits without prior errors', async () => {
    const { worker, spawnInstance, resolve } = createSpawnInstance();

    worker.emit(WorkerEvent.WorkerExit, 1);
    await flushMicrotasks();

    expect(emit).toHaveBeenCalledTimes(1);
    const payload = (emit as jest.Mock).mock.calls[0][0];
    expect(payload.data.error.message).toContain('Worker exited the process');
    expect(resolve).toHaveBeenCalled();

    (spawnInstance as unknown as { clearTimeouts: () => void }).clearTimeouts();
  });

  it('clears timeout timers when handling OOM errors', async () => {
    const clearTimeoutSpy = jest.spyOn(global, 'clearTimeout');
    const { worker, spawnInstance } = createSpawnInstance();

    worker.emit(WorkerEvent.WorkerError, new Error('out of memory'));
    await flushMicrotasks();

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(clearTimeoutSpy.mock.calls.length).toBeGreaterThanOrEqual(2);

    clearTimeoutSpy.mockRestore();
    (spawnInstance as unknown as { clearTimeouts: () => void }).clearTimeouts();
  });

  it('ignores worker exit events after an OOM emission', async () => {
    const { worker, spawnInstance } = createSpawnInstance();

    worker.emit(WorkerEvent.WorkerError, new Error('out of memory'));
    await flushMicrotasks();

    expect(emit).toHaveBeenCalledTimes(1);

    worker.emit(WorkerEvent.WorkerExit, 1);
    await flushMicrotasks();

    expect(emit).toHaveBeenCalledTimes(1);

    (spawnInstance as unknown as { clearTimeouts: () => void }).clearTimeouts();
  });
});
