import {
  AirdropEvent,
  ExtractorEventType,
  EventData,
} from '../types/extraction';
import { AdapterState } from '../state/state.interfaces';
import { Artifact } from '../uploader/uploader.interfaces';
import {
  AIRDROP_DEFAULT_ITEM_TYPES,
  STATELESS_EVENT_TYPES,
} from '../common/constants';
import { State } from '../state/state';
import { WorkerAdapterInterface, WorkerAdapterOptions } from '../types/workers';
import { MessagePort } from 'node:worker_threads';
import { emit } from '../common/control-protocol';
import { WorkerMessageEmitted, WorkerMessageSubject } from '../types/workers';
import { Repo } from '../repo/repo';
import { RepoInterface } from '../repo/repo.interfaces';

export function createWorkerAdapter<ConnectorState>({
  event,
  adapterState,
  parentPort,
  options,
}: WorkerAdapterInterface<ConnectorState>): WorkerAdapter<ConnectorState> {
  return new WorkerAdapter({
    event,
    adapterState,
    parentPort,
    options,
  });
}

/**
 * WorkerAdapter class is used to interact with Airdrop platform. It is passed to the snap-in
 * as parameter in processTask and onTimeout functions. The class provides
 * utilities to emit control events to the platform, update the state of the connector,
 * and upload artifacts to the platform.
 * @class WorkerAdapter
 * @constructor
 * @param {WorkerAdapterInterface} options - The options to create a new instance of WorkerAdapter class
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {object=} initialState - The initial state of the adapter
 * @param {boolean=} isLocalDevelopment - A flag to indicate if the adapter is being used in local development
 * @param {string} workerPath - The path to the worker file
 *
 */
export class WorkerAdapter<ConnectorState> {
  readonly event: AirdropEvent;
  readonly options: WorkerAdapterOptions;

  private adapterState: State<ConnectorState>;
  private _artifacts: Artifact[];
  private hasWorkerEmitted: boolean;
  private parentPort: MessagePort;
  private isTimeout: boolean;
  private repos: Repo[] = [];

  constructor({
    event,
    adapterState,
    parentPort,
    options,
  }: WorkerAdapterInterface<ConnectorState>) {
    this.event = event;
    this.options = options;
    this.adapterState = adapterState;
    this._artifacts = [];
    this.parentPort = parentPort;
    this.hasWorkerEmitted = false;
    this.isTimeout = false;
  }

  get state(): AdapterState<ConnectorState> {
    return this.adapterState.state;
  }

  set state(value: AdapterState<ConnectorState>) {
    if (!this.isTimeout) {
      this.adapterState.state = value;
    }
  }

  initializeRepos(repos: RepoInterface[]) {
    this.repos = repos.map((repo) => {
      const shouldNormalize = !Object.values(
        AIRDROP_DEFAULT_ITEM_TYPES
      ).includes(repo.itemType);

      return new Repo({
        event: this.event,
        itemType: repo.itemType,
        ...(shouldNormalize && { normalize: repo.normalize }),
        onUpload: (artifact: Artifact) => {
          this.artifacts.push(artifact);

          // We need to store artifacts ids in state for later use when streaming attachments
          if (repo.itemType === AIRDROP_DEFAULT_ITEM_TYPES.ATTACHMENTS) {
            this.state.toDevRev?.attachmentsMetadata.artifactIds.push(
              artifact.id
            );
          }
        },
        options: this.options,
      });
    });
  }

  getRepo(itemType: string): Repo | undefined {
    const repo = this.repos.find((repo) => repo.itemType === itemType);

    if (!repo) {
      console.error(`Repo not found for item type: ${itemType}.`);
      return;
    }

    return repo;
  }

  async postState() {
    await this.adapterState.postState();
  }

  get artifacts(): Artifact[] {
    return this._artifacts;
  }

  set artifacts(artifacts: Artifact[]) {
    this._artifacts = this._artifacts
      .concat(artifacts)
      .filter((value, index, self) => self.indexOf(value) === index);
  }

  /**
   *  Emits an event to the platform.
   *
   * @param {ExtractorEventType} newEventType - The event type to be emitted
   * @param {EventData=} data - The data to be sent with the event
   */
  async emit(
    newEventType: ExtractorEventType,
    data?: EventData
  ): Promise<void> {
    if (this.hasWorkerEmitted) {
      console.warn(
        'Unable to emit with event type:' +
          newEventType +
          '. Lambda is going to be stopped.'
      );
      return;
    }

    // We want to upload all the repos before emitting the event, except for the external sync units done event
    if (newEventType !== ExtractorEventType.ExtractionExternalSyncUnitsDone) {
      await this.uploadAllRepos();
    }

    // If the extraction is done, we want to save the timestamp of the last successful sync
    if (newEventType === ExtractorEventType.ExtractionAttachmentsDone) {
      this.state.lastSuccessfulSyncStarted = this.state.lastSyncStarted;
    }

    // We want to save the state every time we emit an event, except for the start and delete events
    if (!STATELESS_EVENT_TYPES.includes(this.event.payload.event_type)) {
      console.log(
        `Saving state before emitting event with event type: ` +
          newEventType +
          '.'
      );
      await this.adapterState.postState(this.state);
    }

    try {
      await emit({
        eventType: newEventType,
        event: this.event,
        data: { ...data, artifacts: this.artifacts },
      });
      const message: WorkerMessageEmitted = {
        subject: WorkerMessageSubject.WorkerMessageEmitted,
        payload: { eventType: newEventType },
      };
      this.artifacts = [];
      this.parentPort.postMessage(message);
    } catch (error) {
      console.error(
        'Error while emitting event with event type: ' + newEventType + '.',
        error
      );
      this.parentPort.postMessage(WorkerMessageSubject.WorkerMessageExit);
    }
  }

  async uploadAllRepos(): Promise<void> {
    for (const repo of this.repos) {
      await repo.upload();
    }
  }

  handleTimeout() {
    this.isTimeout = true;
  }
}
