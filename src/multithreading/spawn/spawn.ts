import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { emit } from '../../common/control-protocol';
import { getMemoryUsage } from '../../common/helpers';
import { Logger, serializeError } from '../../logger/logger';
import { AirSyncEvent, EventType } from '../../types/extraction';
import {
  GetWorkerPathInterface,
  SpawnFactoryInterface,
  SpawnInterface,
  WorkerEvent,
  WorkerMessageSubject,
} from '../../types/workers';

import {
  DEFAULT_LAMBDA_TIMEOUT,
  HARD_TIMEOUT_MULTIPLIER,
  MEMORY_LOG_INTERVAL,
} from '../../common/constants';
import { LogLevel } from '../../logger/logger.interfaces';
import { createWorker } from '../create-worker';
import {
  getTimeoutErrorEventType,
  getNoScriptEventType,
} from './spawn.helpers';

/**
 * Resolves the default worker script path for an incoming event type.
 *
 * Used by `spawn` to pick which built-in worker (external sync units, metadata,
 * data/attachment extraction, data/attachment loading) to run when the caller
 * has not supplied an explicit `workerPath` or override.
 *
 * @param event - The AirSync event whose `payload.event_type` selects the worker.
 * @param workerBasePath - The base directory string the resolved relative worker path is appended to.
 * @returns The full worker script path string, or null if the event type has no matching built-in worker.
 */
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
 * @param options - The options of type SpawnFactoryInterface used to launch the worker.
 * @param options.event - The AirSync event object received from the platform.
 * @param options.initialState - The initial connector state handed to the worker.
 * @param options.initialDomainMapping - The initial domain mapping handed to the worker.
 * @param options.options - Optional SDK behavior overrides (timeout, local development, worker path overrides, etc.).
 * @param options.workerPath - Optional explicit path to the worker script; takes precedence over overrides and the default resolver.
 * @param options.baseWorkerPath - The base path for the worker files, usually `__dirname`.
 * @returns A Promise that resolves once the worker finishes (or a no-script default event is emitted), or rejects if the worker fails to start.
 */
export async function spawn<ConnectorState>({
  event,
  initialState,
  workerPath,
  initialDomainMapping,
  options,
  baseWorkerPath,
}: SpawnFactoryInterface<ConnectorState>): Promise<void> {
  // Read the command line arguments to check if the local flag is passed.
  const argv = await yargs(hideBin(process.argv)).argv;
  if (argv._.includes('local') || argv.local) {
    options = {
      ...(options || {}),
      isLocalDevelopment: true,
    };
  }

  const originalConsole = console;
  // eslint-disable-next-line no-global-assign
  console = new Logger({ event, options });

  if (options?.isLocalDevelopment) {
    console.log('Snap-in is running in local development mode.');
  }

  let script = null;
  if (workerPath != null) {
    script = workerPath;
  } else if (
    baseWorkerPath != null &&
    options?.workerPathOverrides != null &&
    options.workerPathOverrides[event.payload.event_type as EventType] != null
  ) {
    script =
      baseWorkerPath +
      options.workerPathOverrides[event.payload.event_type as EventType];
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

/**
 * Manages the lifecycle of a spawned worker thread for a single event.
 *
 * Used by `spawn` to supervise the worker: it arms a soft timeout (asks the
 * worker to exit gracefully) and a hard timeout (terminates a stuck worker),
 * relays the worker's log messages to the main thread, tracks whether the
 * worker has already emitted an event, periodically logs memory usage, and on
 * worker exit clears the timers and resolves the spawn promise -- emitting a
 * timeout error event if the worker exited without emitting one itself.
 */
export class Spawn {
  private event: AirSyncEvent;
  private alreadyEmitted: boolean;
  private softTimeoutSent: boolean;
  private defaultLambdaTimeout: number = DEFAULT_LAMBDA_TIMEOUT;
  private lambdaTimeout: number;
  private softTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private hardTimeoutTimer: ReturnType<typeof setTimeout> | undefined;
  private memoryMonitoringInterval: ReturnType<typeof setInterval> | undefined;
  private resolve: (value: void | PromiseLike<void>) => void;
  private originalConsole: Console;
  private logger: Logger;
  private workerFailedMessage: string | undefined;
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
    this.softTimeoutSent = false;
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
          this.softTimeoutSent = true;
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
    // main thread. When a soft timeout was sent, we use setImmediate to defer
    // processing so that any pending WorkerMessage events (e.g.
    // WorkerMessageEmitted from onTimeout) already queued in the event loop are
    // handled first, preventing a race condition where exitFromMainThread sees
    // alreadyEmitted=false and emits an error even though the worker
    // successfully emitted an event.
    worker.on(WorkerEvent.WorkerExit, (code: number) => {
      const handler = async () => {
        console.info('Worker exited with exit code: ' + code + '.');
        this.clearTimeouts();
        await this.exitFromMainThread();
      };

      if (this.softTimeoutSent) {
        void setImmediate(() => void handler());
      } else {
        void handler();
      }
    });

    worker.on(WorkerEvent.WorkerMessage, (message) => {
      // Since logs from the worker thread are handled differently in snap-in
      // platform,  we need to catch the log messages from worker thread and log
      // them in main thread.
      if (message?.subject === WorkerMessageSubject.WorkerMessageLog) {
        const stringifiedArgs = message.payload?.stringifiedArgs;
        const level = message.payload?.level as LogLevel;
        const isSdkLog = message.payload?.isSdkLog ?? true;
        this.logger.logFn(stringifiedArgs, level, isSdkLog);
      }

      // If worker sends a message that it has emitted an event, then set alreadyEmitted to true.
      if (message?.subject === WorkerMessageSubject.WorkerMessageEmitted) {
        console.info('Worker has emitted message to AirSync.');
        this.alreadyEmitted = true;
      }

      // If worker sends a failure message before exiting, capture it for use in the error event.
      if (message?.subject === WorkerMessageSubject.WorkerMessageFailed) {
        this.workerFailedMessage = message.payload?.message;
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
            message: `Worker exited without emitting event. ${
              this.workerFailedMessage
                ? `Error: ${this.workerFailedMessage}`
                : 'Check the logs for more information.'
            }`,
          },
        },
      });
    } catch (error) {
      console.error('Error while emitting event.', serializeError(error));
    } finally {
      this.resolve();
    }
  }
}
