import axios from 'axios';
import {
  AirdropEvent,
  ExtractorEventType,
  EventData,
  EventType,
  ExternalSystemAttachmentStreamingFunction,
  ExternalSystemAttachmentProcessors,
  ProcessAttachmentReturnType,
  StreamAttachmentsReturnType,
} from '../types/extraction';
import {
  ActionType,
  ExternalSystemAttachment,
  ExternalSystemLoadingFunction,
  FileToLoad,
  LoaderEventType,
  StatsFileObject,
} from '../types/loading';
import { AdapterState } from '../state/state.interfaces';
import { Artifact, SsorAttachment } from '../uploader/uploader.interfaces';
import {
  AIRDROP_DEFAULT_ITEM_TYPES,
  ALLOWED_EXTRACTION_EVENT_TYPES,
  STATELESS_EVENT_TYPES,
  DEFAULT_SLEEP_DELAY_MS,
} from '../common/constants';
import { State } from '../state/state';
import { WorkerAdapterInterface, WorkerAdapterOptions } from '../types/workers';
import { parentPort } from 'node:worker_threads';
import { emit } from '../common/control-protocol';
import { WorkerMessageEmitted, WorkerMessageSubject } from '../types/workers';
import { Repo } from '../repo/repo';
import { NormalizedAttachment, RepoInterface } from '../repo/repo.interfaces';
import {
  ExternalSystemItem,
  ItemTypesToLoadParams,
  ItemTypeToLoad,
  LoaderReport,
  LoadItemResponse,
  LoadItemTypesResponse,
} from '../types/loading';
import { addReportToLoaderReport, getFilesToLoad } from '../common/helpers';
import { Mappers } from '../mappers/mappers';
import { Uploader } from '../uploader/uploader';
import { serializeError } from '../logger/logger';
import { SyncMapperRecordStatus } from '../mappers/mappers.interface';
import { sleep } from '../common/helpers';
import { AttachmentsStreamingPool } from '../attachments-streaming/attachments-streaming-pool';

export function createWorkerAdapter<ConnectorState>({
  event,
  adapterState,
  options,
}: WorkerAdapterInterface<ConnectorState>): WorkerAdapter<ConnectorState> {
  return new WorkerAdapter({
    event,
    adapterState,
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
  readonly options?: WorkerAdapterOptions;
  isTimeout: boolean;

  private adapterState: State<ConnectorState>;
  private _artifacts: Artifact[];
  private hasWorkerEmitted: boolean;
  private repos: Repo[] = [];

  // Loader
  private loaderReports: LoaderReport[];
  private _processedFiles: string[];
  private mappers: Mappers;
  private uploader: Uploader;

  constructor({
    event,
    adapterState,
    options,
  }: WorkerAdapterInterface<ConnectorState>) {
    this.event = event;
    this.options = options;
    this.adapterState = adapterState;
    this._artifacts = [];
    this.hasWorkerEmitted = false;
    this.isTimeout = false;

    // Loader
    this.loaderReports = [];
    this._processedFiles = [];
    this.mappers = new Mappers({
      event,
      options,
    });
    this.uploader = new Uploader({
      event,
      options,
    });
  }

  get state(): AdapterState<ConnectorState> {
    return this.adapterState.state;
  }

  set state(value: AdapterState<ConnectorState>) {
    if (!this.isTimeout) {
      this.adapterState.state = value;
    }
  }

  get reports(): LoaderReport[] {
    return this.loaderReports;
  }

  get processedFiles(): string[] {
    return this._processedFiles;
  }

  initializeRepos(repos: RepoInterface[]) {
    this.repos = repos.map((repo) => {
      const shouldNormalize =
        repo.itemType !== AIRDROP_DEFAULT_ITEM_TYPES.EXTERNAL_DOMAIN_METADATA &&
        repo.itemType !== AIRDROP_DEFAULT_ITEM_TYPES.SSOR_ATTACHMENT;

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
      console.error(`Repo for item type ${itemType} not found.`);
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
    newEventType: ExtractorEventType | LoaderEventType,
    data?: EventData
  ): Promise<void> {
    if (this.hasWorkerEmitted) {
      console.warn(
        `Trying to emit event with event type: ${newEventType}. Ignoring emit request because it has already been emitted.`
      );
      return;
    }

    // We want to upload all the repos before emitting the event, except for the external sync units done event
    if (newEventType !== ExtractorEventType.ExtractionExternalSyncUnitsDone) {
      try {
        await this.uploadAllRepos();
      } catch (error) {
        console.error('Error while uploading repos', error);
        parentPort?.postMessage(WorkerMessageSubject.WorkerMessageExit);
        this.hasWorkerEmitted = true;
        return;
      }
    }

    // If the extraction is done, we want to save the timestamp of the last successful sync
    if (newEventType === ExtractorEventType.ExtractionAttachmentsDone) {
      console.log(
        `Overwriting lastSuccessfulSyncStarted with lastSyncStarted (${this.state.lastSyncStarted}).`
      );
      this.state.lastSuccessfulSyncStarted = this.state.lastSyncStarted;
      this.state.lastSyncStarted = '';
    }

    // We want to save the state every time we emit an event, except for the start and delete events
    if (!STATELESS_EVENT_TYPES.includes(this.event.payload.event_type)) {
      console.log(
        `Saving state before emitting event with event type: ${newEventType}.`
      );

      try {
        await this.adapterState.postState(this.state);
      } catch (error) {
        console.error('Error while posting state', error);
        parentPort?.postMessage(WorkerMessageSubject.WorkerMessageExit);
        this.hasWorkerEmitted = true;
        return;
      }
    }

    try {
      await emit({
        eventType: newEventType,
        event: this.event,
        data: {
          ...data,
          ...(ALLOWED_EXTRACTION_EVENT_TYPES.includes(
            this.event.payload.event_type
          )
            ? { artifacts: this.artifacts }
            : {}),
        },
      });

      const message: WorkerMessageEmitted = {
        subject: WorkerMessageSubject.WorkerMessageEmitted,
        payload: { eventType: newEventType },
      };
      this.artifacts = [];
      parentPort?.postMessage(message);
      this.hasWorkerEmitted = true;
    } catch (error) {
      console.error(
        `Error while emitting event with event type: ${newEventType}.`,
        serializeError(error)
      );
      parentPort?.postMessage(WorkerMessageSubject.WorkerMessageExit);
      this.hasWorkerEmitted = true;
    }
  }

  async uploadAllRepos(): Promise<void> {
    for (const repo of this.repos) {
      const error = await repo.upload();
      if (error) {
        throw error;
      }
    }
  }

  handleTimeout() {
    this.isTimeout = true;
  }

  async loadItemTypes({
    itemTypesToLoad,
  }: ItemTypesToLoadParams): Promise<LoadItemTypesResponse> {
    if (this.event.payload.event_type === EventType.StartLoadingData) {
      const itemTypes = itemTypesToLoad.map(
        (itemTypeToLoad) => itemTypeToLoad.itemType
      );

      if (!itemTypes.length) {
        console.warn('No item types to load, returning.');
        return {
          reports: this.reports,
          processed_files: this.processedFiles,
        };
      }

      const filesToLoad = await this.getLoaderBatches({
        supportedItemTypes: itemTypes,
      });
      this.adapterState.state.fromDevRev = {
        filesToLoad,
      };
    }

    if (
      !this.adapterState.state.fromDevRev ||
      !this.adapterState.state.fromDevRev.filesToLoad.length
    ) {
      console.warn('No files to load, returning.');
      return {
        reports: this.reports,
        processed_files: this.processedFiles,
      };
    }

    console.log(
      'Files to load in state',
      this.adapterState.state.fromDevRev?.filesToLoad
    );

    outerloop: for (const fileToLoad of this.adapterState.state.fromDevRev
      .filesToLoad) {
      const itemTypeToLoad = itemTypesToLoad.find(
        (itemTypeToLoad: ItemTypeToLoad) =>
          itemTypeToLoad.itemType === fileToLoad.itemType
      );

      if (!itemTypeToLoad) {
        console.error(
          `Item type to load not found for item type: ${fileToLoad.itemType}.`
        );

        await this.emit(LoaderEventType.DataLoadingError, {
          error: {
            message: `Item type to load not found for item type: ${fileToLoad.itemType}.`,
          },
        });

        break;
      }

      if (!fileToLoad.completed) {
        const transformerFile = (await this.uploader.getJsonObjectByArtifactId({
          artifactId: fileToLoad.id,
          isGzipped: true,
        })) as ExternalSystemItem[];

        if (!transformerFile) {
          console.error(
            `Transformer file not found for artifact ID: ${fileToLoad.id}.`
          );
          await this.emit(LoaderEventType.DataLoadingError, {
            error: {
              message: `Transformer file not found for artifact ID: ${fileToLoad.id}.`,
            },
          });
        }

        for (let i = fileToLoad.lineToProcess; i < fileToLoad.count; i++) {
          const { report, rateLimit } = await this.loadItem({
            item: transformerFile[i],
            itemTypeToLoad,
          });

          if (rateLimit?.delay) {
            await this.emit(LoaderEventType.DataLoadingDelay, {
              delay: rateLimit.delay,
              reports: this.reports,
              processed_files: this.processedFiles,
            });

            break outerloop;
          }

          if (report) {
            addReportToLoaderReport({
              loaderReports: this.loaderReports,
              report,
            });
            fileToLoad.lineToProcess = fileToLoad.lineToProcess + 1;
          }
        }

        fileToLoad.completed = true;
        this._processedFiles.push(fileToLoad.id);
      }
    }

    return {
      reports: this.reports,
      processed_files: this.processedFiles,
    };
  }

  async getLoaderBatches({
    supportedItemTypes,
  }: {
    supportedItemTypes: string[];
  }) {
    const statsFileArtifactId = this.event.payload.event_data?.stats_file;

    if (statsFileArtifactId) {
      const statsFile = (await this.uploader.getJsonObjectByArtifactId({
        artifactId: statsFileArtifactId,
      })) as StatsFileObject[];

      if (!statsFile || statsFile.length === 0) {
        return [] as FileToLoad[];
      }

      const filesToLoad = getFilesToLoad({
        supportedItemTypes,
        statsFile,
      });

      return filesToLoad;
    }

    return [] as FileToLoad[];
  }

  async loadAttachments({
    create,
  }: {
    create: ExternalSystemLoadingFunction<ExternalSystemAttachment>;
  }): Promise<LoadItemTypesResponse> {
    if (this.event.payload.event_type === EventType.StartLoadingAttachments) {
      this.adapterState.state.fromDevRev = {
        filesToLoad: await this.getLoaderBatches({
          supportedItemTypes: ['attachment'],
        }),
      };
    }

    if (
      !this.adapterState.state.fromDevRev ||
      this.adapterState.state.fromDevRev?.filesToLoad.length === 0
    ) {
      console.log('No files to load, returning.');
      return {
        reports: this.reports,
        processed_files: this.processedFiles,
      };
    }

    outerloop: for (const fileToLoad of this.adapterState.state.fromDevRev
      ?.filesToLoad) {
      if (!fileToLoad.completed) {
        const transformerFile = (await this.uploader.getJsonObjectByArtifactId({
          artifactId: fileToLoad.id,
          isGzipped: true,
        })) as ExternalSystemAttachment[];

        if (!transformerFile) {
          console.error(
            `Transformer file not found for artifact ID: ${fileToLoad.id}.`
          );
          break outerloop;
        }

        for (let i = fileToLoad.lineToProcess; i < fileToLoad.count; i++) {
          const { report, rateLimit } = await this.loadAttachment({
            item: transformerFile[i],
            create,
          });

          if (rateLimit?.delay) {
            await this.emit(LoaderEventType.DataLoadingDelay, {
              delay: rateLimit.delay,
              reports: this.reports,
              processed_files: this.processedFiles,
            });

            break outerloop;
          }

          if (report) {
            addReportToLoaderReport({
              loaderReports: this.loaderReports,
              report,
            });
            fileToLoad.lineToProcess = fileToLoad.lineToProcess + 1;
          }
        }

        fileToLoad.completed = true;
        this._processedFiles.push(fileToLoad.id);
      }
    }

    return {
      reports: this.reports,
      processed_files: this.processedFiles,
    };
  }

  async loadItem({
    item,
    itemTypeToLoad,
  }: {
    item: ExternalSystemItem;
    itemTypeToLoad: ItemTypeToLoad;
  }): Promise<LoadItemResponse> {
    const devrevId = item.id.devrev;

    try {
      const syncMapperRecordResponse = await this.mappers.getByTargetId({
        sync_unit: this.event.payload.event_context.sync_unit,
        target: devrevId,
      });

      const syncMapperRecord = syncMapperRecordResponse.data;
      if (!syncMapperRecord) {
        console.warn('Failed to get sync mapper record from response.');
        return {
          error: {
            message: 'Failed to get sync mapper record from response.',
          },
        };
      }

      // Update item in external system
      const { id, modifiedDate, delay, error } = await itemTypeToLoad.update({
        item,
        mappers: this.mappers,
        event: this.event,
      });

      if (id) {
        if (modifiedDate) {
          try {
            await this.mappers.update({
              id: syncMapperRecord.sync_mapper_record.id,
              sync_unit: this.event.payload.event_context.sync_unit,
              status: SyncMapperRecordStatus.OPERATIONAL,
              external_versions: {
                add: [
                  {
                    modified_date: modifiedDate,
                    recipe_version: 0,
                  },
                ],
              },
              external_ids: {
                add: [id],
              },
              targets: {
                add: [devrevId],
              },
            });
          } catch (error) {
            console.warn(
              'Failed to update sync mapper record.',
              serializeError(error)
            );
            return {
              error: {
                message:
                  'Failed to update sync mapper record' + serializeError(error),
              },
            };
          }
        }

        return {
          report: {
            item_type: itemTypeToLoad.itemType,
            [ActionType.UPDATED]: 1,
          },
        };
      } else if (delay) {
        console.log(
          `Rate limited while updating item in external system, delaying for ${delay} seconds.`
        );

        return {
          rateLimit: {
            delay,
          },
        };
      } else {
        console.warn('Failed to update item in external system', error);
        return {
          report: {
            item_type: itemTypeToLoad.itemType,
            [ActionType.FAILED]: 1,
          },
        };
      }

      // TODO: Update mapper (optional)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // Create item in external system if mapper record not found
          const { id, delay, error } = await itemTypeToLoad.create({
            item,
            mappers: this.mappers,
            event: this.event,
          });

          if (id) {
            // Create mapper
            try {
              await this.mappers.create({
                sync_unit: this.event.payload.event_context.sync_unit,
                status: SyncMapperRecordStatus.OPERATIONAL,
                external_ids: [id],
                targets: [devrevId],
              });

              return {
                report: {
                  item_type: itemTypeToLoad.itemType,
                  [ActionType.CREATED]: 1,
                },
              };
            } catch (error) {
              console.warn(
                'Failed to create sync mapper record.',
                serializeError(error)
              );
              return {
                error: {
                  message:
                    'Failed to create sync mapper record. ' +
                    serializeError(error),
                },
              };
            }
          } else if (delay) {
            return {
              rateLimit: {
                delay,
              },
            };
          } else {
            console.warn(
              'Failed to create item in external system.',
              serializeError(error)
            );
            return {
              report: {
                item_type: itemTypeToLoad.itemType,
                [ActionType.FAILED]: 1,
              },
            };
          }
        } else {
          console.warn(
            'Failed to get sync mapper record.',
            serializeError(error)
          );
          return {
            error: {
              message: error.message,
            },
          };
        }
      }

      console.warn('Failed to get sync mapper record.', serializeError(error));
      return {
        error: {
          message: 'Failed to get sync mapper record. ' + serializeError(error),
        },
      };
    }
  }

  async processAttachment(
    attachment: NormalizedAttachment,
    stream: ExternalSystemAttachmentStreamingFunction
  ): Promise<ProcessAttachmentReturnType> {
    const { httpStream, delay, error } = await stream({
      item: attachment,
      event: this.event,
    });

    if (error) {
      console.warn('Error while streaming attachment', error);
      return { error };
    } else if (delay) {
      return { delay };
    }

    if (httpStream) {
      const fileType =
        httpStream.headers?.['content-type'] || 'application/octet-stream';

      // Get upload URL
      const preparedArtifact = await this.uploader.getArtifactUploadUrl(
        attachment.file_name,
        fileType
      );

      if (!preparedArtifact) {
        console.warn(
          `Error while preparing artifact for attachment ID ${attachment.id}. Skipping attachment.`
        );
        return;
      }

      // Stream attachment
      const uploadedArtifact = await this.uploader.streamArtifact(
        preparedArtifact,
        httpStream
      );

      if (!uploadedArtifact) {
        console.warn(
          `Error while streaming to artifact for attachment ID ${attachment.id}. Skipping attachment.`
        );
        return;
      }

      // Confirm attachment upload
      const confirmArtifactUploadResponse =
        await this.uploader.confirmArtifactUpload(preparedArtifact.artifact_id);
      if (!confirmArtifactUploadResponse) {
        console.warn(
          'Error while confirming upload for attachment ID ' + attachment.id
        );
        return;
      }

      const ssorAttachment: SsorAttachment = {
        id: {
          devrev: preparedArtifact.artifact_id,
          external: attachment.id,
        },
        parent_id: {
          external: attachment.parent_id,
        },
      };

      if (attachment.author_id) {
        ssorAttachment.actor_id = {
          external: attachment.author_id,
        };
      }

      // This will set inline flag in ssor_attachment only if it is explicity
      // set in the attachment object.
      if (attachment.inline === true) {
        ssorAttachment.inline = true;
      } else if (attachment.inline === false) {
        ssorAttachment.inline = false;
      }

      await this.getRepo('ssor_attachment')?.push([ssorAttachment]);
    }
    return;
  }

  async loadAttachment({
    item,
    create,
  }: {
    item: ExternalSystemAttachment;
    create: ExternalSystemLoadingFunction<ExternalSystemAttachment>;
  }): Promise<LoadItemResponse> {
    // Create item
    const { id, delay, error } = await create({
      item,
      mappers: this.mappers,
      event: this.event,
    });

    if (delay) {
      return {
        rateLimit: {
          delay,
        },
      };
    } else if (id) {
      return {
        report: {
          item_type: 'attachment',
          [ActionType.CREATED]: 1,
        },
      };
    } else {
      console.warn('Failed to create attachment in external system', error);
      return {
        report: {
          item_type: 'attachment',
          [ActionType.FAILED]: 1,
        },
      };
    }
  }

  /**
   * Streams the attachments to the DevRev platform.
   * The attachments are streamed to the platform and the artifact information is returned.
   * @param {{ stream, processors }: { stream: ExternalSystemAttachmentStreamingFunction, processors?: ExternalSystemAttachmentProcessors  }} Params - The parameters to stream the attachments
   * @returns {Promise<StreamAttachmentsReturnType>} - The response object containing the ssorAttachment artifact information
   * or error information if there was an error
   */
  async streamAttachments<NewBatch>({
    stream,
    processors,
    batchSize = 1, // By default, we want to stream one attachment at a time
  }: {
    stream: ExternalSystemAttachmentStreamingFunction;
    processors?: ExternalSystemAttachmentProcessors<
      ConnectorState,
      NormalizedAttachment[],
      NewBatch
    >;
    batchSize?: number;
  }): Promise<StreamAttachmentsReturnType> {
    if (batchSize <= 0) {
      console.warn(
        `The specified batch size (${batchSize}) is invalid. Using 1 instead.`
      );
      batchSize = 1;
    }

    if (batchSize > 50) {
      console.warn(
        `The specified batch size (${batchSize}) is too large. Using 50 instead.`
      );
      batchSize = 50;
    }

    const repos = [
      {
        itemType: 'ssor_attachment',
      },
    ];
    this.initializeRepos(repos);

    const attachmentsMetadata = this.state.toDevRev?.attachmentsMetadata;

    // If there are no attachments metadata artifact IDs in state, finish here
    if (!attachmentsMetadata?.artifactIds?.length) {
      console.log(`No attachments metadata artifact IDs found in state.`);
      return;
    } else {
      console.log(
        `Found ${attachmentsMetadata.artifactIds.length} attachments metadata artifact IDs in state.`
      );
    }

    // Loop through the attachments metadata artifact IDs
    while (attachmentsMetadata.artifactIds.length > 0) {
      const attachmentsMetadataArtifactId = attachmentsMetadata.artifactIds[0];

      console.log(
        `Started processing attachments for attachments metadata artifact ID: ${attachmentsMetadataArtifactId}.`
      );

      const { attachments, error } =
        await this.uploader.getAttachmentsFromArtifactId({
          artifact: attachmentsMetadataArtifactId,
        });

      if (error) {
        console.error(
          `Failed to get attachments for artifact ID: ${attachmentsMetadataArtifactId}.`
        );
        return { error };
      }

      if (!attachments || attachments.length === 0) {
        console.warn(
          `No attachments found for artifact ID: ${attachmentsMetadataArtifactId}.`
        );
        // Remove empty artifact and reset lastProcessed
        attachmentsMetadata.artifactIds.shift();
        attachmentsMetadata.lastProcessed = 0;
        continue;
      }

      console.log(
        `Found ${attachments.length} attachments for artifact ID: ${attachmentsMetadataArtifactId}.`
      );

      let response;

      if (processors) {
        console.log(`Using custom processors for attachments.`);

        const reducer = processors.reducer;
        const iterator = processors.iterator;

        const reducedAttachments = reducer({
          attachments,
          adapter: this,
          batchSize,
        });

        response = await iterator({
          reducedAttachments,
          adapter: this,
          stream,
        });
      } else {
        console.log(
          `Using attachments streaming pool for attachments streaming.`
        );

        const attachmentsPool = new AttachmentsStreamingPool<ConnectorState>({
          adapter: this,
          attachments,
          batchSize,
          stream,
        });

        response = await attachmentsPool.streamAll();
      }

      if (response?.delay || response?.error) {
        return response;
      }

      console.log(
        `Finished processing all attachments for artifact ID: ${attachmentsMetadataArtifactId}.`
      );
      attachmentsMetadata.artifactIds.shift();
      attachmentsMetadata.lastProcessed = 0;
      if (attachmentsMetadata.lastProcessedAttachmentsIdsList) {
        attachmentsMetadata.lastProcessedAttachmentsIdsList.length = 0;
      }
    }

    return;
  }
}
