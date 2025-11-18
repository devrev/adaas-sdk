import { Worker } from 'worker_threads';

import type { LogLevel } from '../logger/logger.interfaces';
import { State } from '../state/state';
import { WorkerAdapter } from '../workers/worker-adapter';

import { AirdropEvent, EventType, ExtractorEventType } from './extraction';

import { LoaderEventType } from './loading';

import { InitialDomainMapping } from './common';

/**
 * WorkerAdapterInterface is an interface for WorkerAdapter class.
 * @interface WorkerAdapterInterface
 * @constructor
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {object=} initialState - The initial state of the adapter
 * @param {WorkerAdapterInterface} options - The options to create a new instance of WorkerAdapter class
 */
export interface WorkerAdapterInterface<ConnectorState> {
  event: AirdropEvent;
  adapterState: State<ConnectorState>;
  options?: WorkerAdapterOptions;
}

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
}

/**
 * SpawnInterface is an interface for Spawn class.
 * @interface SpawnInterface
 * @constructor
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {Worker} worker - The worker thread
 */
export interface SpawnInterface {
  event: AirdropEvent;
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
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {object=} initialState - The initial state of the adapter
 * @param {string} workerPath - The path to the worker file
 * @param {string} initialDomainMapping - The initial domain mapping
 * @param {WorkerAdapterOptions} options - The options to create a new instance of Spawn class
 * @param {string=} baseWorkerPath - The base path for the worker files, usually `__dirname`
 */
export interface SpawnFactoryInterface<ConnectorState> {
  event: AirdropEvent;
  initialState: ConnectorState;
  workerPath?: string;
  options?: WorkerAdapterOptions;
  initialDomainMapping?: InitialDomainMapping;
  baseWorkerPath?: string;
}

/**
 * TaskAdapterInterface is an interface for TaskAdapter class.
 * @interface TaskAdapterInterface
 * @constructor
 * @param {WorkerAdapter} adapter - The adapter object
 */
export interface TaskAdapterInterface<ConnectorState> {
  adapter: WorkerAdapter<ConnectorState>;
}

/**
 * ProcessTaskInterface is an interface for ProcessTask class.
 * @interface ProcessTaskInterface
 * @constructor
 * @param {function} task - The task to be executed, returns exit code
 * @param {function} onTimeout - The task to be executed on timeout, returns exit code
 */
export interface ProcessTaskInterface<ConnectorState> {
  task: (params: TaskAdapterInterface<ConnectorState>) => Promise<void>;
  onTimeout: (params: TaskAdapterInterface<ConnectorState>) => Promise<void>;
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
    sdk_log?: boolean;
  };
}

/**
 * WorkerMessage represents the structure of the worker message.
 */
export type WorkerMessage =
  | WorkerMessageEmitted
  | WorkerMessageExit
  | WorkerMessageLog;

/**
 * WorkerData represents the structure of the worker data object.
 */
export interface WorkerData<ConnectorState> {
  event: AirdropEvent;
  initialState: ConnectorState;
  workerPath: string;
  initialDomainMapping?: InitialDomainMapping;
  options?: WorkerAdapterOptions;
}

/**
 * GetWorkerPathInterface is an interface for getting the worker path.
 */
export interface GetWorkerPathInterface {
  event: AirdropEvent;
  workerBasePath?: string | null;
}

/**
 * WorkerPathOverrides represents a mapping of event types to custom worker paths.
 */
export type WorkerPathOverrides = Partial<Record<EventType, string>>;
