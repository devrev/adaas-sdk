import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { emit } from '../common/control-protocol';
import { translateIncomingEventType } from '../common/event-type-translation';
import {
  getMemoryUsage,
  getTimeoutErrorEventType,
  getNoScriptEventType,
} from '../common/helpers';
import { Logger, serializeError } from '../logger/logger';
import { AirdropEvent, EventType } from '../types/extraction';
import {
  GetWorkerPathInterface,
  SpawnFactoryInterface,
  SpawnInterface,
  WorkerEvent,
  WorkerMessageSubject,
} from '../types/workers';

import {
  DEFAULT_LAMBDA_TIMEOUT,
  HARD_TIMEOUT_MULTIPLIER,
  MEMORY_LOG_INTERVAL,
} from '../common/constants';
import { LogLevel } from '../logger/logger.interfaces';
import { createWorker } from './create-worker';

function getWorkerPath({
  event,
  workerBasePath,
}: GetWorkerPathInterface): string | null {
  let path = null;
  switch (event.payload.event_type) {
    case EventType.StartExtractingExternalSyncUnits:
      path = '/workers/external-sync-units-extraction';
      break;
    case EventType.StartExtractingMetadata:
      path = '/workers/metadata-extraction';
      break;
    case EventType.StartExtractingData:
    case EventType.ContinueExtractingData:
      path = '/workers/data-extraction';
      break;
    case EventType.StartExtractingAttachments:
    case EventType.ContinueExtractingAttachments:
      path = '/workers/attachments-extraction';
      break;
    case EventType.StartLoadingData:
    case EventType.ContinueLoadingData:
      path = '/workers/load-data';
      break;
    case EventType.StartLoadingAttachments:
    case EventType.ContinueLoadingAttachments:
      path = '/workers/load-attachments';
      break;
  }

  return path ? workerBasePath + path : null;
}

/**
 * Creates a new instance of Spawn class.
 * Spawn class is responsible for spawning a new worker thread and managing the lifecycle of the worker.
 * The class provides utilities to emit control events to the platform and exit the worker gracefully.
 * In case of lambda timeout, the class emits a lambda timeout event to the platform.
 * @param {SpawnFactoryInterface} options - The options to create a new instance of Spawn class
 * @param {AirdropEvent} options.event - The event object received from the platform
 * @param {object} options.initialState - The initial state of the adapter
 * @param {string} [options.workerPath] Remove getWorkerPath function and use baseWorkerPath: __dirname instead of workerPath
 * @param {string} [options.baseWorkerPath] - The base path for the worker files, usually `__dirname`
 * @returns {Promise<Spawn>} - A new instance of Spawn class
 */
export async function spawn<ConnectorState>({
  event,
  initialState,
  workerPath,
  initialDomainMapping,
  options,
  baseWorkerPath,
}: SpawnFactoryInterface<ConnectorState>): Promise<void> {
  // Translate incoming event type for backwards compatibility. This allows the
  // SDK to accept both old and new event type formats. Then update the event with the translated event type.
  const originalEventType = event.payload.event_type;
  const translatedEventType = translateIncomingEventType(
    event.payload.event_type as string
  );
  event.payload.event_type = translatedEventType;

  // Read the command line arguments to check if the local flag is passed.
  const argv = await yargs(hideBin(process.argv)).argv;
  if (argv._.includes('local')) {
    options = {
      ...(options || {}),
      isLocalDevelopment: true,
    };
  }

  const originalConsole = console;
  // eslint-disable-next-line no-global-assign
  console = new Logger({ event, options });

  if (translatedEventType !== originalEventType) {
    console.log(
      `Event type translated from ${originalEventType} to ${translatedEventType}.`
    );
  }
  if (options?.isLocalDevelopment) {
    console.log('Snap-in is running in local development mode.');
  }

  let script = null;
  if (workerPath != null) {
    script = workerPath;
  } else if (
    baseWorkerPath != null &&
    options?.workerPathOverrides != null &&
    options.workerPathOverrides[translatedEventType as EventType] != null
  ) {
    script =
      baseWorkerPath +
      options.workerPathOverrides[translatedEventType as EventType];
  } else {
    script = getWorkerPath({
      event,
      workerBasePath: baseWorkerPath ?? __dirname,
    });
  }

  // If a script is found for the event type, spawn a new worker.
  if (script) {
    try {
      const worker = await createWorker<ConnectorState>({
        event,
        initialState,
        workerPath: script,
        initialDomainMapping,
        options,
      });

      return new Promise((resolve) => {
        new Spawn({
          event,
          worker,
          options,
          resolve,
          originalConsole,
        });
      });
    } catch (error) {
      console.error('Worker error while processing task', error);

      // eslint-disable-next-line no-global-assign
      console = originalConsole;
      return Promise.reject(error);
    }
  } else {
    const { eventType } = getNoScriptEventType(event.payload.event_type);

    await emit({
      event,
      eventType,
    });

    // eslint-disable-next-line no-global-assign
    console = originalConsole;
    return Promise.resolve();
  }
}

export class Spawn {
  private event: AirdropEvent;
  private alreadyEmitted: boolean;
  private defaultLambdaTimeout: number = DEFAULT_LAMBDA_TIMEOUT;
  private lambdaTimeout: number;
  private softTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private hardTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private memoryMonitoringInterval: ReturnType<typeof setInterval> | undefined;
  private resolve: (value: void | PromiseLike<void>) => void;
  private originalConsole: Console;
  private logger: Logger;
  constructor({
    event,
    worker,
    options,
    resolve,
    originalConsole,
  }: SpawnInterface) {
    this.originalConsole = originalConsole || console;
    this.logger = console as Logger;
    this.alreadyEmitted = false;
    this.event = event;
    this.lambdaTimeout = options?.timeout
      ? Math.min(options.timeout, this.defaultLambdaTimeout)
      : this.defaultLambdaTimeout;
    this.resolve = resolve;

    // If soft timeout is reached, send a message to the worker to gracefully exit.
    this.softTimeoutTimer = setTimeout(
      () =>
        void (async () => {
          console.log(
            'SOFT TIMEOUT: Sending a message to the worker to gracefully exit.'
          );
          if (worker) {
            worker.postMessage({
              subject: WorkerMessageSubject.WorkerMessageExit,
            });
          } else {
            console.log('Worker does not exist. Exiting from main thread.');
            await this.exitFromMainThread();
          }
        })(),
      this.lambdaTimeout
    );

    // If hard timeout is reached, that means the worker did not exit in time. Terminate the worker.
    this.hardTimeoutTimer = setTimeout(
      () =>
        void (async () => {
          console.error(
            'HARD TIMEOUT: Worker did not exit in time. Terminating the worker.'
          );
          if (worker) {
            await worker.terminate();
          } else {
            console.log('Worker does not exist. Exiting from main thread.');
            await this.exitFromMainThread();
          }
        })(),
      this.lambdaTimeout * HARD_TIMEOUT_MULTIPLIER
    );

    // If worker exits with process.exit(code), clear the timeouts and exit from
    // main thread.
    worker.on(
      WorkerEvent.WorkerExit,
      (code: number) =>
        void (async () => {
          console.info('Worker exited with exit code: ' + code + '.');
          this.clearTimeouts();
          await this.exitFromMainThread();
        })()
    );

    worker.on(WorkerEvent.WorkerMessage, (message) => {
      // Since logs from the worker thread are handled differently in snap-in
      // platform,  we need to catch the log messages from worker thread and log
      // them in main thread.
      if (message?.subject === WorkerMessageSubject.WorkerMessageLog) {
        const stringifiedArgs = message.payload?.stringifiedArgs;
        const level = message.payload?.level as LogLevel;
        this.logger.logFn(stringifiedArgs, level);
      }

      // If worker sends a message that it has emitted an event, then set alreadyEmitted to true.
      if (message?.subject === WorkerMessageSubject.WorkerMessageEmitted) {
        console.info('Worker has emitted message to ADaaS.');
        this.alreadyEmitted = true;
      }
    });

    // Log memory usage every 30 seconds
    this.memoryMonitoringInterval = setInterval(() => {
      try {
        const memoryInfo = getMemoryUsage();
        if (memoryInfo) {
          console.info(memoryInfo.formattedMessage);
        }
      } catch (error) {
        // If memory monitoring fails, log the warning and clear the interval to prevent further issues
        console.warn(
          'Memory monitoring failed, stopping logging of memory usage interval',
          error
        );
        if (this.memoryMonitoringInterval) {
          clearInterval(this.memoryMonitoringInterval);
          this.memoryMonitoringInterval = undefined;
        }
      }
    }, MEMORY_LOG_INTERVAL);
  }

  private clearTimeouts(): void {
    if (this.softTimeoutTimer) {
      clearTimeout(this.softTimeoutTimer);
    }
    if (this.hardTimeoutTimer) {
      clearTimeout(this.hardTimeoutTimer);
    }
    if (this.memoryMonitoringInterval) {
      clearInterval(this.memoryMonitoringInterval);
    }
  }

  private async exitFromMainThread(): Promise<void> {
    this.clearTimeouts();

    // eslint-disable-next-line no-global-assign
    console = this.originalConsole;

    if (this.alreadyEmitted) {
      this.resolve();
      return;
    }
    this.alreadyEmitted = true;

    const { eventType } = getTimeoutErrorEventType(
      this.event.payload.event_type
    );

    try {
      await emit({
        eventType,
        event: this.event,
        data: {
          error: {
            message:
              'Worker exited the process without emitting an event. Check other logs for more information.',
          },
        },
      });

      this.resolve();
    } catch (error) {
      console.error('Error while emitting event.', serializeError(error));
    }
  }
}
