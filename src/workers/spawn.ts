import axios from 'axios';
import { hideBin } from 'yargs/helpers';
import yargs from 'yargs';

import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../types/extraction';
import { emit } from '../common/control-protocol';
import { getTimeoutErrorEventType, getMemoryUsage } from '../common/helpers';
import { Logger, serializeError } from '../logger/logger';
import {
  GetWorkerPathInterface,
  WorkerEvent,
  WorkerMessageSubject,
  SpawnFactoryInterface,
  SpawnInterface,
} from '../types/workers';

import { createWorker } from './create-worker';
import { LogLevel } from '../logger/logger.interfaces';
import {
  DEFAULT_LAMBDA_TIMEOUT,
  HARD_TIMEOUT_MULTIPLIER,
  MEMORY_LOG_INTERVAL,
} from '../common/constants';
import { createUserLogger, getInternalLogger } from '../logger/private_logger';

function getWorkerPath({
  event,
  connectorWorkerPath,
}: GetWorkerPathInterface): string | null {
  if (connectorWorkerPath) return connectorWorkerPath;
  let path = null;
  switch (event.payload.event_type) {
    // Extraction
    case EventType.ExtractionExternalSyncUnitsStart:
      path = __dirname + '/default-workers/external-sync-units-extraction';
      break;
    case EventType.ExtractionMetadataStart:
      path = __dirname + '/default-workers/metadata-extraction';
      break;
    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
      path = __dirname + '/default-workers/data-extraction';
      break;
    case EventType.ExtractionAttachmentsStart:
    case EventType.ExtractionAttachmentsContinue:
      path = __dirname + '/default-workers/attachments-extraction';
      break;
    case EventType.ExtractionDataDelete:
      path = __dirname + '/default-workers/data-deletion';
      break;
    case EventType.ExtractionAttachmentsDelete:
      path = __dirname + '/default-workers/attachments-deletion';
      break;

    // Loading
    case EventType.StartLoadingData:
    case EventType.ContinueLoadingData:
      path = __dirname + '/default-workers/load-data';
      break;
    case EventType.StartLoadingAttachments:
    case EventType.ContinueLoadingAttachments:
      path = __dirname + '/default-workers/load-attachments';
      break;
    case EventType.StartDeletingLoaderState:
      path = __dirname + '/default-workers/delete-loader-state';
      break;
    case EventType.StartDeletingLoaderAttachmentState:
      path = __dirname + '/default-workers/delete-loader-attachment-state';
      break;
    default:
      path = null;
  }
  return path;
}

/**
 * Creates a new instance of Spawn class.
 * Spawn class is responsible for spawning a new worker thread and managing the lifecycle of the worker.
 * The class provides utilities to emit control events to the platform and exit the worker gracefully.
 * In case of lambda timeout, the class emits a lambda timeout event to the platform.
 * @param {SpawnFactoryInterface} options - The options to create a new instance of Spawn class
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {object} initialState - The initial state of the adapter
 * @param {string} workerPath - The path to the worker file
 * @returns {Promise<Spawn>} - A new instance of Spawn class
 */
export async function spawn<ConnectorState>({
  event,
  initialState,
  workerPath,
  initialDomainMapping,
  options,
}: SpawnFactoryInterface<ConnectorState>): Promise<void> {
  const logger = getInternalLogger(new Logger({ event, options }));
  const unverified_logger = createUserLogger(new Logger({ event, options }));
  const script = getWorkerPath({
    event,
    connectorWorkerPath: workerPath,
  });

  if (options?.isLocalDevelopment) {
    logger.warn(
      'WARN: isLocalDevelopment is deprecated. Please use the -- local flag instead.'
    );
  }

  // read the command line arguments to check if the local flag is passed
  const argv = await yargs(hideBin(process.argv)).argv;
  if (argv._.includes('local')) {
    options = {
      ...(options || {}),
      isLocalDevelopment: true,
    };
  }

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
        });
      });
    } catch (error) {
      unverified_logger.error('Worker error while processing task', error);
    }
  } else {
    console.error(
      'Script was not found for event type: ' + event.payload.event_type + '.'
    );

    try {
      await emit({
        event,
        eventType: ExtractorEventType.UnknownEventType,
        data: {
          error: {
            message:
              'Unrecognized event type in spawn ' +
              event.payload.event_type +
              '.',
          },
        },
      });
    } catch (error) {
      console.error('Error while emitting event.', serializeError(error));
    }
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
  private logger: Logger;
  private unverified_logger: Logger;
  private resolve: (value: void | PromiseLike<void>) => void;

  constructor({ event, worker, options, resolve }: SpawnInterface) {
    this.alreadyEmitted = false;
    this.event = event;
    this.logger = getInternalLogger(new Logger({ event, options }));
    this.unverified_logger = createUserLogger(new Logger({ event, options }));
    this.lambdaTimeout = options?.timeout
      ? Math.min(options.timeout, this.defaultLambdaTimeout)
      : this.defaultLambdaTimeout;
    this.resolve = resolve;

    // If soft timeout is reached, send a message to the worker to gracefully exit.
    this.softTimeoutTimer = setTimeout(async () => {
      this.logger.log(
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
    }, this.lambdaTimeout);

    // If hard timeout is reached, that means the worker did not exit in time. Terminate the worker.
    this.hardTimeoutTimer = setTimeout(async () => {
      this.logger.error(
        'HARD TIMEOUT: Worker did not exit in time. Terminating the worker.'
      );
      if (worker) {
        worker.terminate();
      } else {
        console.log('Worker does not exist. Exiting from main thread.');
        await this.exitFromMainThread();
      }
    }, this.lambdaTimeout * HARD_TIMEOUT_MULTIPLIER);

    // If worker exits with process.exit(code), clear the timeouts and exit from main thread.
    worker.on(WorkerEvent.WorkerExit, async (code) => {
      this.logger.info('Worker exited with exit code: ' + code + '.');
      this.clearTimeouts();
      await this.exitFromMainThread();
    });

    worker.on(WorkerEvent.WorkerMessage, async (message) => {
      // Since it is not possible to log from the worker thread, we need to log
      // from the main thread.
      if (message?.subject === WorkerMessageSubject.WorkerMessageLog) {
        const args = message.payload?.args;
        const level = message.payload?.level as LogLevel;
        this.unverified_logger.logFn(args, level);
      }

      // If worker sends a message that it has emitted an event, then set alreadyEmitted to true.
      if (message?.subject === WorkerMessageSubject.WorkerMessageEmitted) {
        this.logger.info('Worker has emitted message to ADaaS.');
        this.alreadyEmitted = true;
      }
    });

    // Log memory usage every 10 seconds
    this.memoryMonitoringInterval = setInterval(() => {
      const memoryInfo = getMemoryUsage();
      if (memoryInfo) {
        this.logger.info(memoryInfo.formattedMessage);
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
            message: 'Worker has not emitted anything. Exited.',
          },
        },
      });

      this.resolve();
    } catch (error) {
      console.error('Error while emitting event.', serializeError(error));
    }
  }
}
