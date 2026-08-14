import { Worker } from 'worker_threads';

import type { LogLevel } from '../logger/logger.interfaces';
import { BaseState } from '../state/state';

import { ErrorRecord, InitialDomainMapping } from './common';
import { AirSyncEvent, EventType, ExtractorEventType } from './extraction';
import { LoaderEventType } from './loading';

export interface WorkerAdapterInterface<ConnectorState> {
  event: AirSyncEvent;
  adapterState: BaseState<ConnectorState>;
  options?: WorkerAdapterOptions;
}

/** Parsed extraction scope from the platform, keyed by item type name. */
export type ExtractionScope = Record<string, { extract: boolean }>;

export interface WorkerAdapterOptions {
  isLocalDevelopment?: boolean;
  /** Worker thread timeout. */
  timeout?: number;
  /** Maximum number of extracted items in a batch. */
  batchSize?: number;
  workerPathOverrides?: WorkerPathOverrides;
  skipConfirmation?: boolean;
}

export interface SpawnInterface {
  event: AirSyncEvent;
  worker: Worker;
  options?: WorkerAdapterOptions;
  resolve: (value: void | PromiseLike<void>) => void;
  originalConsole?: Console;
}

export interface SpawnFactoryInterface<ConnectorState> {
  event: AirSyncEvent;
  initialState: ConnectorState;
  options?: WorkerAdapterOptions;
  initialDomainMapping?: InitialDomainMapping;
  /** Base path for the worker files, usually `__dirname`. */
  baseWorkerPath?: string;
}

/**
 * Returned by a worker's `task`/`onTimeout` callback; the SDK (never the connector)
 * maps it to the phase-appropriate platform event and emits it exactly once.
 * One invocation = one worker = one emitted event; continuation happens in a
 * fresh platform-driven invocation.
 *
 * Status -> emitted event: 'success' -> *_DONE; 'error' -> *_ERROR;
 * 'progress' -> *_PROGRESS and 'delay' -> *_DELAYED in resumable phases
 * (data/attachment extraction and loading), but *_ERROR in non-resumable
 * phases (external sync units, metadata), where they are illegal.
 */
export type TaskResult =
  | { status: 'success' }
  | { status: 'progress' }
  | { status: 'delay'; delaySeconds: number }
  | { status: 'error'; error: ErrorRecord };

export type TaskStatus = TaskResult['status'];

/** Parameter shape passed to a worker's task and onTimeout callbacks. */
export interface TaskAdapterInterface<Adapter> {
  adapter: Adapter;
}

/**
 * If `onTimeout` is omitted, the SDK emits a phase-appropriate default on
 * timeout: progress for resumable phases, error for ESU/metadata.
 */
export interface ProcessTaskInterface<Adapter> {
  task: (params: TaskAdapterInterface<Adapter>) => Promise<TaskResult>;
  onTimeout?: (params: TaskAdapterInterface<Adapter>) => Promise<TaskResult>;
}

export enum WorkerEvent {
  WorkerMessage = 'message',
  WorkerOnline = 'online',
  WorkerError = 'error',
  WorkerExit = 'exit',
}

export enum WorkerMessageSubject {
  WorkerMessageEmitted = 'emit',
  WorkerMessageExit = 'exit',
  WorkerMessageLog = 'log',
  WorkerMessageFailed = 'failed',
}

export interface WorkerMessageEmitted {
  subject: WorkerMessageSubject.WorkerMessageEmitted;
  payload: {
    eventType: ExtractorEventType | LoaderEventType;
  };
}

export interface WorkerMessageExit {
  subject: WorkerMessageSubject.WorkerMessageExit;
}

export interface WorkerMessageLog {
  subject: WorkerMessageSubject.WorkerMessageLog;
  payload: {
    stringifiedArgs: string;
    level: LogLevel;
  };
}

/** Sent from the worker thread before process.exit(1) to convey the error reason to the main thread. */
export interface WorkerMessageFailed {
  subject: WorkerMessageSubject.WorkerMessageFailed;
  payload: { message: string };
}

export type WorkerMessage =
  | WorkerMessageEmitted
  | WorkerMessageExit
  | WorkerMessageLog
  | WorkerMessageFailed;

export interface WorkerData<ConnectorState> {
  event: AirSyncEvent;
  initialState: ConnectorState;
  workerPath: string;
  initialDomainMapping?: InitialDomainMapping;
  options?: WorkerAdapterOptions;
}

export interface GetWorkerPathInterface {
  event: AirSyncEvent;
  workerBasePath?: string | null;
}

/** Maps event types to custom worker paths, overriding the defaults. */
export type WorkerPathOverrides = Partial<Record<EventType, string>>;
