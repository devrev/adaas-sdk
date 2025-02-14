import { Worker } from 'node:worker_threads';

import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../types/extraction';
import { emit } from '../common/control-protocol';
import { getTimeoutErrorEventType } from '../common/helpers';
import { Logger } from '../logger/logger';
import {
  GetWorkerPathInterface,
  WorkerEvent,
  WorkerMessageSubject,
  SpawnFactoryInterface,
  SpawnInterface,
  SpawnResolve,
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
}: SpawnFactoryInterface<ConnectorState>): Promise<
  boolean | PromiseLike<boolean>
> {
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

      return new Promise<boolean>((resolve) => {
        new Spawn({
          event,
          worker,
          options,
          resolve,
        });
      });
    } catch (error) {
      logger.error('Worker error while processing task.', error);
      return false;
    }
  } else {
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
    return false;
  }
}

export class Spawn {
  private event: AirdropEvent;
  private hasWorkerEmitted: boolean;
  private defaultLambdaTimeout: number = 10 * 60 * 1000; // 10 minutes in milliseconds
  private lambdaTimeout: number;
  private worker: Worker | null;
  private resolve: SpawnResolve;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private logger: Logger;

  constructor({ event, worker, options, resolve }: SpawnInterface) {
    this.hasWorkerEmitted = false;
    this.event = event;
    this.lambdaTimeout = options?.timeout
      ? Math.min(options.timeout, this.defaultLambdaTimeout)
      : this.defaultLambdaTimeout;

    this.resolve = resolve;
    this.timer = setTimeout(async () => {
      this.logger.log('Lambda timeout reached. Exiting.');

      if (this.worker) {
        this.worker.postMessage({
          subject: WorkerMessageSubject.WorkerMessageExit,
        });
      } else {
        await this.exitFromMainThread();
      }
    }, this.lambdaTimeout);

    this.logger = new Logger({ event, options });
    this.worker = worker;
    worker.on(WorkerEvent.WorkerExit, async (code) => {
      this.logger.info('Worker exited with exit code: ' + code + '.');
      if (this.timer) {
        clearTimeout(this.timer);
      }
      await this.exitFromMainThread();
    });
    worker.on(WorkerEvent.WorkerMessage, async (message) => {
      if (message?.subject === WorkerMessageSubject.WorkerMessageEmitted) {
        this.logger.info('Worker has emitted message to ADaaS.');
        this.hasWorkerEmitted = true;
      }
      if (message?.subject === WorkerMessageSubject.WorkerMessageDone) {
        this.logger.info('Worker has completed work.');
        clearTimeout(this.timer);
        await this.exitFromMainThread();
      }
    });

    worker.on(WorkerEvent.WorkerMessage, (message) => {
      if (message?.subject === WorkerMessageSubject.WorkerMessageLog) {
        const args = message.payload?.args;
        const level = message.payload?.level as LogLevel;
        this.logger.logFn(args, level);
      }
    });
  }

  private async exitFromMainThread(): Promise<void> {
    if (this.hasWorkerEmitted) {
      this.resolve(true);
      return;
    }

    const timeoutEventType = getTimeoutErrorEventType(
      this.event.payload.event_type
    );
    if (timeoutEventType !== null) {
      const { eventType } = timeoutEventType;
      await emit({
        eventType,
        event: this.event,
        data: {
          error: {
            message: 'Worker has not emitted anything. Exited.',
          },
        },
      }).then(() => {
        this.logger.error('Worker has not emitted anything. Exited.');
        this.resolve(true);
      });
    }
  }
}
