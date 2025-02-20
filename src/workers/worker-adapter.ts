import { axios } from '../http/axios-devrev-client';
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
} from '../common/constants';
import { State } from '../state/state';
import { WorkerAdapterInterface, WorkerAdapterOptions } from '../types/workers';
import { MessagePort } from 'node:worker_threads';
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
import { serializeAxiosError } from '../logger/logger';
import { SyncMapperRecordStatus } from '../mappers/mappers.interface';

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
  readonly options?: WorkerAdapterOptions;

  private adapterState: State<ConnectorState>;
  private _artifacts: Artifact[];
  private hasWorkerEmitted: boolean;
  private parentPort: MessagePort;
  private isTimeout: boolean;
  private repos: Repo[] = [];

  // Loader
  private loaderReports: LoaderReport[];
  private _processedFiles: string[];
  private mappers: Mappers;
  private uploader: Uploader;

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
    newEventType: ExtractorEventType | LoaderEventType,
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
      this.state.lastSyncStarted = '';
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
      this.parentPort.postMessage(message);
      this.hasWorkerEmitted = true;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while emitting event with event type: ' + newEventType + '.',
          serializeAxiosError(error)
        );
      } else {
        console.error(
          'Error while emitting event with event type: ' + newEventType + '.',
          error
        );
      }

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

  async loadItemTypes({
    itemTypesToLoad,
  }: ItemTypesToLoadParams): Promise<LoadItemTypesResponse> {
    if (this.event.payload.event_type === EventType.StartLoadingData) {
      this.adapterState.state.fromDevRev = {
        filesToLoad: await this.getLoaderBatches({
          supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
        }),
      };
    }

    if (this.adapterState.state.fromDevRev?.filesToLoad.length === 0) {
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
      ?.filesToLoad || []) {
      const itemTypeToLoad = itemTypesToLoad.find(
        (itemTypeToLoad: ItemTypeToLoad) =>
          itemTypeToLoad.itemType === fileToLoad.itemType
      );

      if (!itemTypeToLoad) {
        console.error(
          `Item type to load not found for item type: ${fileToLoad.itemType}.`
        );

        await emit({
          event: this.event,
          eventType: LoaderEventType.DataLoadingError,
          data: {
            error: {
              message: `Item type to load not found for item type: ${fileToLoad.itemType}.`,
            },
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
          console.error('Transformer file not found.');
          break outerloop;
        }

        for (let i = fileToLoad.lineToProcess; i < fileToLoad.count; i++) {
          const { report, rateLimit } = await this.loadItem({
            item: transformerFile[i],
            itemTypeToLoad,
          });

          if (rateLimit?.delay) {
            await emit({
              event: this.event,
              eventType: LoaderEventType.DataLoadingDelay,
              data: {
                delay: rateLimit.delay,
                reports: this.reports,
                processed_files: this.processedFiles,
              },
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
          console.error('Transformer file not found.');
          break outerloop;
        }

        for (let i = fileToLoad.lineToProcess; i < fileToLoad.count; i++) {
          const { report, rateLimit } = await this.loadAttachment({
            item: transformerFile[i],
            create,
          });

          if (rateLimit?.delay) {
            await emit({
              event: this.event,
              eventType: LoaderEventType.DataLoadingDelay,
              data: {
                delay: rateLimit.delay,
                reports: this.reports,
                processed_files: this.processedFiles,
              },
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
        console.error('Failed to get sync mapper record from response.');
        return {
          error: {
            message: 'Failed to get sync mapper record from response.',
          },
        };
      }

      // Update item
      const { id, modifiedDate, delay, error } = await itemTypeToLoad.update({
        item,
        mappers: this.mappers,
        event: this.event,
      });

      if (id) {
        if (modifiedDate) {
          try {
            const updateSyncMapperRecordResponse = await this.mappers.update({
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

            console.log(
              'Updated sync mapper record',
              JSON.stringify(updateSyncMapperRecordResponse.data)
            );
          } catch (error) {
            if (axios.isAxiosError(error)) {
              console.error(
                'Failed to update sync mapper record',
                serializeAxiosError(error)
              );
              return {
                error: {
                  message: error.message,
                },
              };
            } else {
              console.error('Failed to update sync mapper record', error);
              return {
                error: {
                  message: 'Failed to update sync mapper record' + error,
                },
              };
            }
          }
        }

        return {
          report: {
            item_type: itemTypeToLoad.itemType,
            [ActionType.UPDATED]: 1,
          },
        };
      } else if (delay) {
        console.log('Rate limited, delaying for', delay);

        return {
          rateLimit: {
            delay,
          },
        };
      } else {
        console.error('Failed to update item', error);
        return {
          report: {
            item_type: itemTypeToLoad.itemType,
            [ActionType.FAILED]: 1,
          },
        };
      }

      // Update mapper (optional)
    } catch (error) {
      if (axios.isAxiosError(error)) {
        if (error.response?.status === 404) {
          // Create item
          const { id, delay, error } = await itemTypeToLoad.create({
            item,
            mappers: this.mappers,
            event: this.event,
          });

          if (id) {
            // Create mapper
            try {
              const createdSyncMapperRecordResponse = await this.mappers.create(
                {
                  sync_unit: this.event.payload.event_context.sync_unit,
                  status: SyncMapperRecordStatus.OPERATIONAL,
                  external_ids: [id],
                  targets: [devrevId],
                }
              );

              console.log(
                'Created sync mapper record',
                createdSyncMapperRecordResponse.data.sync_mapper_record.id
              );

              return {
                report: {
                  item_type: itemTypeToLoad.itemType,
                  [ActionType.CREATED]: 1,
                },
              };
            } catch (error) {
              if (axios.isAxiosError(error)) {
                console.error(
                  'Failed to create sync mapper record',
                  serializeAxiosError(error)
                );
                return {
                  error: {
                    message: error.message,
                  },
                };
              }

              console.error('Failed to create sync mapper record', error);
              return {
                error: {
                  message: 'Failed to create sync mapper record' + error,
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
            console.error('Failed to create item', error);
            return {
              report: {
                item_type: itemTypeToLoad.itemType,
                [ActionType.FAILED]: 1,
              },
            };
          }
        } else {
          console.error(
            'Failed to get sync mapper record',
            serializeAxiosError(error)
          );
          return {
            error: {
              message: error.message,
            },
          };
        }
      }

      console.error('Failed to get sync mapper record', error);
      return {
        error: {
          message: 'Failed to get sync mapper record' + error,
        },
      };
    }
  }

  processAttachment = async (
    attachment: NormalizedAttachment,
    stream: ExternalSystemAttachmentStreamingFunction
  ): Promise<ProcessAttachmentReturnType> => {
    const { httpStream, delay, error } = await stream({
      item: attachment,
      event: this.event,
    });

    if (error) {
      console.warn('Error while streaming attachment', error?.message);
      return { error };
    } else if (delay) {
      return { delay };
    }

    if (httpStream) {
      const fileType =
        httpStream.headers?.['content-type'] || 'application/octet-stream';

      const preparedArtifact = await this.uploader.prepareArtifact(
        attachment.file_name,
        fileType
      );
      if (!preparedArtifact) {
        console.warn(
          'Error while preparing artifact for attachment ID ' +
            attachment.id +
            '. Skipping attachment'
        );
        return;
      }

      const uploadedArtifact = await this.uploader.streamToArtifact(
        preparedArtifact,
        httpStream
      );

      if (!uploadedArtifact) {
        console.warn(
          'Error while preparing artifact for attachment ID ' + attachment.id
        );
        return;
      }

      const ssorAttachment: SsorAttachment = {
        id: {
          devrev: preparedArtifact.id,
          external: attachment.id,
        },
        parent_id: {
          external: attachment.parent_id,
        },
        actor_id: {
          external: attachment.author_id,
        },
      };

      await this.getRepo('ssor_attachment')?.push([ssorAttachment]);
    }
    return;
  };

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
      console.error('Failed to create item', error);
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
   * @returns {Promise<StreamAttachmentsReturnType>} - The response object containing the ssoAttachment artifact information
   * or error information if there was an error
   */
  async streamAttachments<NewBatch>({
    stream,
    processors,
  }: {
    stream: ExternalSystemAttachmentStreamingFunction;
    processors?: ExternalSystemAttachmentProcessors<
      ConnectorState,
      NormalizedAttachment[],
      NewBatch
    >;
  }): Promise<StreamAttachmentsReturnType> {
    const repos = [
      {
        itemType: 'ssor_attachment',
      },
    ];
    this.initializeRepos(repos);
    const attachmentsState = (
      this.state.toDevRev?.attachmentsMetadata.artifactIds || []
    ).slice();

    console.log('Attachments metadata artifact IDs', attachmentsState);
    for (const attachmentsMetadataArtifactId of attachmentsState) {
      console.log(
        `Started processing attachments for artifact ID: ${attachmentsMetadataArtifactId}.`
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
        continue;
      }

      if (processors) {
        console.log(`Using custom processors for attachments.`);
        const { reducer, iterator } = processors;
        const reducedAttachments = reducer({ attachments, adapter: this });

        const response = await iterator({
          reducedAttachments,
          adapter: this,
          stream,
        });
        if (response?.delay || response?.error) {
          return response;
        }
      } else {
        console.log(`Using default processors for attachments.`);
        const attachmentsToProcess = attachments.slice(
          this.state.toDevRev?.attachmentsMetadata?.lastProcessed,
          attachments.length
        );

        for (const attachment of attachmentsToProcess) {
          const response = await this.processAttachment(attachment, stream);
          if (response?.delay || response?.error) {
            return response;
          }

          if (this.state.toDevRev) {
            this.state.toDevRev.attachmentsMetadata.lastProcessed += 1;
          }
        }
      }

      if (this.state.toDevRev) {
        console.log(
          `Finished processing attachments for artifact ID. Setting last processed to 0 and removing artifact ID from state.`
        );
        this.state.toDevRev.attachmentsMetadata.artifactIds.shift();
        this.state.toDevRev.attachmentsMetadata.lastProcessed = 0;
      }
    }

    return;
  }
}
