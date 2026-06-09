import { Worker } from 'worker_threads';

import type { LogLevel } from '../logger/logger.interfaces';
import { BaseState } from '../state/state';

import { AirSyncEvent, EventType, ExtractorEventType } from './extraction';

import { LoaderEventType } from './loading';

import { ErrorRecord, InitialDomainMapping } from './common';

/**
 * WorkerAdapterInterface is an interface for WorkerAdapter class.
 * @interface WorkerAdapterInterface
 * @constructor
 * @param {AirSyncEvent} event - The event object received from the platform
 * @param {object=} initialState - The initial state of the adapter
 * @param {WorkerAdapterInterface} options - The options to create a new instance of WorkerAdapter class
 */
export interface WorkerAdapterInterface<ConnectorState> {
  event: AirSyncEvent;
  adapterState: BaseState<ConnectorState>;
  options?: WorkerAdapterOptions;
}

/**
 * ExtractionScope represents the parsed extraction scope from the platform.
 * Each key is an item type name, and the value indicates whether it should be extracted.
 */
export type ExtractionScope = Record<string, { extract: boolean }>;

/**
 * WorkerAdapterOptions represents the options for WorkerAdapter class.
 * @interface WorkerAdapterOptions
 * @constructor
 * @param {boolean=} isLocalDevelopment - A flag to indicate if the adapter is being used in local development
 * @param {number=} timeout - The timeout for the worker thread
 * @param {number=} batchSize - Maximum number of extracted items in a batch
 * @param {Record<EventType, string>=} workerPathOverrides - A map of event types to custom worker paths to override default worker paths
 */
export interface WorkerAdapterOptions {
  isLocalDevelopment?: boolean;
  timeout?: number;
  batchSize?: number;
  workerPathOverrides?: WorkerPathOverrides;
  skipConfirmation?: boolean;
}

/**
 * SpawnInterface is an interface for Spawn class.
 * @interface SpawnInterface
 * @constructor
 * @param {AirSyncEvent} event - The event object received from the platform
 * @param {Worker} worker - The worker thread
 */
export interface SpawnInterface {
  event: AirSyncEvent;
  worker: Worker;
  options?: WorkerAdapterOptions;
  resolve: (value: void | PromiseLike<void>) => void;
  originalConsole?: Console;
}

/**
 * SpawnFactoryInterface is an interface for Spawn class factory.
 * Spawn class is responsible for spawning a new worker thread and managing the lifecycle of the worker.
 * The class provides utilities to emit control events to the platform and exit the worker gracefully.
 * In case of lambda timeout, the class emits a lambda timeout event to the platform.
 * @interface SpawnFactoryInterface
 * @constructor
 * @param {AirSyncEvent} event - The event object received from the platform
 * @param {object=} initialState - The initial state of the adapter
 * @param {string} workerPath - The path to the worker file
 * @param {string} initialDomainMapping - The initial domain mapping
 * @param {WorkerAdapterOptions} options - The options to create a new instance of Spawn class
 * @param {string=} baseWorkerPath - The base path for the worker files, usually `__dirname`
 */
export interface SpawnFactoryInterface<ConnectorState> {
  event: AirSyncEvent;
  initialState: ConnectorState;

  /** @deprecated Remove getWorkerPath function and use baseWorkerPath: __dirname instead of workerPath */
  workerPath?: string;
  options?: WorkerAdapterOptions;
  initialDomainMapping?: InitialDomainMapping;
  baseWorkerPath?: string;
}

/**
 * TaskResult is the value a worker's `task` (and optional `onTimeout`) callback
 * returns to tell the SDK how the current phase ended. The SDK — not the
 * connector — maps this status to the phase-appropriate platform event and
 * emits it exactly once. Connectors never call `emit` directly.
 *
 * One lambda invocation = one worker process = exactly one emitted event =
 * terminal. Any continuation (CONTINUE_*, next phase, retry after delay)
 * happens in a fresh invocation driven by the platform.
 *
 * The discriminant is a bare string literal, so connectors write e.g.
 * `return { status: 'delay', delaySeconds: 60 }` with no import.
 *
 * Status -> emitted event, per phase:
 *
 * | status     | resumable phases | non-resumable (ESU / metadata) |
 * |------------|------------------|--------------------------------|
 * | 'success'  | *_DONE           | *_DONE                         |
 * | 'progress' | *_PROGRESS       | *_ERROR (illegal; descriptive) |
 * | 'delay'    | *_DELAYED        | *_ERROR (illegal; descriptive) |
 * | 'error'    | *_ERROR          | *_ERROR                        |
 *
 * Resumable phases: data/attachment extraction, data/attachment loading.
 * Non-resumable phases: external sync units, metadata.
 */
export type TaskResult =
  | { status: 'success' }
  | { status: 'progress' }
  | { status: 'delay'; delaySeconds: number }
  | { status: 'error'; error: ErrorRecord };

/**
 * Discriminant string of a {@link TaskResult}.
 */
export type TaskStatus = TaskResult['status'];

/**
 * TaskAdapterInterface is the parameter shape passed to a worker's task and
 * onTimeout callbacks.
 * @param adapter - The mode-specific adapter for the worker.
 */
export interface TaskAdapterInterface<Adapter> {
  adapter: Adapter;
}

/**
 * ProcessTaskInterface is the parameter shape for the process-task entry points.
 *
 * Both callbacks return a {@link TaskResult}; the SDK — not the connector —
 * maps that status to the phase-appropriate platform event and emits it exactly
 * once. Connectors never call `emit` directly.
 *
 * `onTimeout` is optional: if omitted, the SDK emits a phase-appropriate default
 * on timeout (progress for resumable phases, error for ESU/metadata).
 *
 * @param task - Runs the phase; returns how it ended.
 * @param onTimeout - Runs only on timeout; returns how to hand off.
 */
export interface ProcessTaskInterface<Adapter> {
  task: (params: TaskAdapterInterface<Adapter>) => Promise<TaskResult>;
  onTimeout?: (params: TaskAdapterInterface<Adapter>) => Promise<TaskResult>;
}

/**
 * WorkerEvent represents the standard worker events.
 */
export enum WorkerEvent {
  WorkerMessage = 'message',
  WorkerOnline = 'online',
  WorkerError = 'error',
  WorkerExit = 'exit',
}

/**
 * WorkerMessageSubject represents the handled worker message subjects.
 */
export enum WorkerMessageSubject {
  WorkerMessageEmitted = 'emit',
  WorkerMessageExit = 'exit',
  WorkerMessageLog = 'log',
  WorkerMessageFailed = 'failed',
}

/**
 * WorkerMessageEmitted interface represents the structure of the emitted worker message.
 */
export interface WorkerMessageEmitted {
  subject: WorkerMessageSubject.WorkerMessageEmitted;
  payload: {
    eventType: ExtractorEventType | LoaderEventType;
  };
}

/**
 * WorkerMessageExit interface represents the structure of the exit worker message.
 */
export interface WorkerMessageExit {
  subject: WorkerMessageSubject.WorkerMessageExit;
}

/**
 * WorkerMessageLog interface represents the structure of the worker log message.
 */
export interface WorkerMessageLog {
  subject: WorkerMessageSubject.WorkerMessageLog;
  payload: {
    stringifiedArgs: string;
    level: LogLevel;
    isSdkLog?: boolean;
  };
}

/**
 * WorkerMessageFailed interface represents the structure of the worker failed message.
 * Sent from the worker thread before calling process.exit(1) to convey the specific
 * error reason to the main thread.
 */
export interface WorkerMessageFailed {
  subject: WorkerMessageSubject.WorkerMessageFailed;
  payload: { message: string };
}

/**
 * WorkerMessage represents the structure of the worker message.
 */
export type WorkerMessage =
  | WorkerMessageEmitted
  | WorkerMessageExit
  | WorkerMessageLog
  | WorkerMessageFailed;

/**
 * WorkerData represents the structure of the worker data object.
 */
export interface WorkerData<ConnectorState> {
  event: AirSyncEvent;
  initialState: ConnectorState;
  workerPath: string;
  initialDomainMapping?: InitialDomainMapping;
  options?: WorkerAdapterOptions;
}

/**
 * GetWorkerPathInterface is an interface for getting the worker path.
 */
export interface GetWorkerPathInterface {
  event: AirSyncEvent;
  workerBasePath?: string | null;
}

/**
 * WorkerPathOverrides represents a mapping of event types to custom worker paths.
 */
export type WorkerPathOverrides = Partial<Record<EventType, string>>;
