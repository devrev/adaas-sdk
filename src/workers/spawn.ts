import axios from 'axios';
import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../types/extraction';
import { emit } from '../common/control-protocol';
import { getTimeoutErrorEventType } from '../common/helpers';
import { Logger, serializeAxiosError } from '../logger/logger';
import {
  GetWorkerPathInterface,
  WorkerEvent,
  WorkerMessageSubject,
  SpawnFactoryInterface,
  SpawnInterface,
} from '../types/workers';

import { createWorker } from './create-worker';
import { LogLevel } from '../logger/logger.interfaces';

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
  options,
}: SpawnFactoryInterface<ConnectorState>): Promise<void> {
  const logger = new Logger({ event, options });
  const script = getWorkerPath({
    event,
    connectorWorkerPath: workerPath,
    options,
  });

  if (script) {
    try {
      const worker = await createWorker<ConnectorState>({
        event,
        initialState,
        workerPath: script,
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
      logger.error('Worker error while processing task', error);
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
      if (axios.isAxiosError(error)) {
        console.error('Error while emitting event', serializeAxiosError(error));
      } else {
        console.error('Error while emitting event', error);
      }
    }
  }
}

export class Spawn {
  private event: AirdropEvent;
  private alreadyEmitted: boolean;
  private defaultLambdaTimeout: number = 10 * 60 * 1000; // 10 minutes in milliseconds
  private lambdaTimeout: number;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private logger: Logger;
  private resolve: (value: void | PromiseLike<void>) => void;

  constructor({ event, worker, options, resolve }: SpawnInterface) {
    this.alreadyEmitted = false;
    this.event = event;
    this.logger = new Logger({ event, options });
    this.lambdaTimeout = options?.timeout
      ? Math.min(options.timeout, this.defaultLambdaTimeout)
      : this.defaultLambdaTimeout;
    this.resolve = resolve;

    // if lambda timeout is reached, then send a message to the worker to gracefully exit
    this.timer = setTimeout(async () => {
      this.logger.log(
        'Lambda timeout reached. Sending a message to the worker to gracefully exit.'
      );
      if (worker) {
        worker.postMessage({
          subject: WorkerMessageSubject.WorkerMessageExit,
        });
      } else {
        console.log("Worker doesn't exist. Exiting from main thread.");
        await this.exitFromMainThread();
      }
    }, this.lambdaTimeout);

    // if worker exits with process.exit(code) then we need to clear the timer and exit from main thread
    worker.on(WorkerEvent.WorkerExit, async (code) => {
      this.logger.info('Worker exited with exit code: ' + code + '.');
      if (this.timer) {
        clearTimeout(this.timer);
      }
      await this.exitFromMainThread();
    });

    worker.on(WorkerEvent.WorkerMessage, async (message) => {
      // if worker send a log message, then log it from the main thread with logger
      if (message?.subject === WorkerMessageSubject.WorkerMessageLog) {
        const args = message.payload?.args;
        const level = message.payload?.level as LogLevel;
        this.logger.logFn(args, level);
      }

      // if worker sends a message that it has completed work, then clear the timer and exit from main thread
      if (message?.subject === WorkerMessageSubject.WorkerMessageDone) {
        this.logger.info('Worker has completed with executing the task.');
        if (this.timer) {
          clearTimeout(this.timer);
        }
        await this.exitFromMainThread();
      }

      // if worker sends a message that it has emitted an event, then set alreadyEmitted to true
      if (message?.subject === WorkerMessageSubject.WorkerMessageEmitted) {
        this.logger.info('Worker has emitted message to ADaaS.');
        this.alreadyEmitted = true;
      }
    });
  }

  private async exitFromMainThread(): Promise<void> {
    if (this.alreadyEmitted) {
      this.resolve();
      return;
    }
    this.alreadyEmitted = true;

    const timeoutEventType = getTimeoutErrorEventType(
      this.event.payload.event_type
    );

    if (timeoutEventType) {
      const { eventType } = timeoutEventType;

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
        if (axios.isAxiosError(error)) {
          console.error(
            'Error while emitting event',
            serializeAxiosError(error)
          );
        } else {
          console.error('Error while emitting event', error);
        }
      }
    }
  }
}
