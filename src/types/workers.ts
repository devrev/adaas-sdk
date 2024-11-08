import { Worker } from 'worker_threads';
import { MessagePort } from 'node:worker_threads';

import { State } from '../state/state';
import { WorkerAdapter } from '../workers/worker-adapter';

import { ExtractorEventType, AirdropEvent } from './extraction';

/**
 * WorkerAdapterInterface is an interface for WorkerAdapter class.
 * @interface WorkerAdapterInterface
 * @constructor
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {object=} initialState - The initial state of the adapter
 * @param {MessagePort} parentPort - The parent port of the worker thread
 * @param {WorkerAdapterInterface} options - The options to create a new instance of WorkerAdapter class
 */
export interface WorkerAdapterInterface<ConnectorState> {
  event: AirdropEvent;
  adapterState: State<ConnectorState>;
  parentPort: MessagePort;
  options: WorkerAdapterOptions;
}

/**
 * WorkerAdapterOptions represents the options for WorkerAdapter class.
 * @interface WorkerAdapterOptions
 * @constructor
 * @param {boolean=} isLocalDevelopment - A flag to indicate if the adapter is being used in local development
 * @param {number=} timeout - The timeout for the worker thread
 */
export interface WorkerAdapterOptions {
  isLocalDevelopment?: boolean;
  timeout?: number;
}

export type SpawnResolve = (value: boolean | PromiseLike<boolean>) => void;

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
  options: WorkerAdapterOptions | null;
  resolve: SpawnResolve;
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
 * @param {WorkerAdapterOptions} options - The options to create a new instance of Spawn class
 */
export interface SpawnFactoryInterface<ConnectorState> {
  event: AirdropEvent;
  initialState: ConnectorState;
  workerPath?: string;
  options?: WorkerAdapterOptions;
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
  task: (params: TaskAdapterInterface<ConnectorState>) => void;
  onTimeout: (params: TaskAdapterInterface<ConnectorState>) => void;
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
  WorkerMessageDone = 'done',
  WorkerMessageExit = 'exit',
  WorkerMessageLog = 'log',
}

/**
 * WorkerMessageEmitted interface represents the structure of the emitted worker message.
 */
export interface WorkerMessageEmitted {
  subject: WorkerMessageSubject.WorkerMessageEmitted;
  payload: {
    eventType: ExtractorEventType;
  };
}

/**
 * WorkerMessageDone interface represents the structure of the done worker message.
 */
export interface WorkerMessageDone {
  subject: WorkerMessageSubject.WorkerMessageDone;
}

/**
 * WorkerMessageExit interface represents the structure of the exit worker message.
 */
export interface WorkerMessageExit {
  subject: WorkerMessageSubject.WorkerMessageExit;
}

/**
 * WorkerMessage represents the structure of the worker message.
 */
export type WorkerMessage =
  | WorkerMessageDone
  | WorkerMessageEmitted
  | WorkerMessageExit;

/**
 * WorkerData represents the structure of the worker data object.
 */
export interface WorkerData<ConnectorState> {
  event: AirdropEvent;
  initialState: ConnectorState;
  workerPath: string;
  options?: WorkerAdapterOptions;
}

/**
 * GetWorkerPathInterface is an interface for getting the worker path.
 */
export interface GetWorkerPathInterface {
  event: AirdropEvent;
  connectorWorkerPath?: string | null;
}
