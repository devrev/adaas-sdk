import axios from 'axios';

import { serializeError } from '../../logger/logger';
import {
  runWithSdkLogContext,
  runWithUserLogContext,
} from '../../logger/logger.context';
import { Mappers } from '../../mappers/mappers';
import { SyncMapperRecordStatus } from '../../mappers/mappers.interface';
import { LoadingState } from '../../state/loading-state';
import {
  AirSyncEvent,
  EventData,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import {
  ActionType,
  ExternalSystemAttachment,
  ExternalSystemItem,
  ExternalSystemLoadingFunction,
  FileToLoad,
  ItemTypesToLoadParams,
  ItemTypeToLoad,
  LoaderEventType,
  LoaderReport,
  LoadItemResponse,
  LoadItemTypesResponse,
  StatsFileObject,
} from '../../types/loading';
import { WorkerAdapterOptions } from '../../types/workers';

import { BaseAdapter } from './base-adapter';
import {
  addReportToLoaderReport,
  getFilesToLoad,
} from './loading-adapter.helpers';

/**
 * LoadingAdapter is the adapter passed to loading tasks. It exposes the loading
 * surface (item/attachment loading, mappers, loader reports).
 *
 * @public
 */
export class LoadingAdapter<ConnectorState> extends BaseAdapter<
  ConnectorState,
  LoadingState<ConnectorState>
> {
  private loaderReports: LoaderReport[];
  private _processedFiles: string[];
  private _mappers: Mappers;

  constructor(params: {
    event: AirSyncEvent;
    adapterState: LoadingState<ConnectorState>;
    options?: WorkerAdapterOptions;
  }) {
    super(params);
    this.loaderReports = [];
    this._processedFiles = [];
    this._mappers = new Mappers({
      event: params.event,
      options: params.options,
    });
  }

  get reports(): LoaderReport[] {
    return this.loaderReports;
  }

  get processedFiles(): string[] {
    return this._processedFiles;
  }

  get mappers(): Mappers {
    return this._mappers;
  }

  protected async beforeEmit(): Promise<void> {
    // Loading has no pre-emit work (no repos, no extraction boundaries).
  }

  protected buildEmitPayload(
    newEventType: ExtractorEventType | LoaderEventType
  ): EventData {
    const isLoaderEvent = Object.values(LoaderEventType).includes(
      newEventType as LoaderEventType
    );
    return isLoaderEvent
      ? {
          reports: this.reports,
          processed_files: this.processedFiles,
        }
      : {};
  }

  protected afterEmit(): void {
    // Loading keeps its accumulated reports/processed files across emits.
  }

  async loadItemTypes({
    itemTypesToLoad,
  }: ItemTypesToLoadParams): Promise<LoadItemTypesResponse> {
    return runWithSdkLogContext(async () => {
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
        this.adapterState.sdkState.fromDevRev = {
          filesToLoad,
        };
      }

      if (
        !this.adapterState.sdkState.fromDevRev ||
        !this.adapterState.sdkState.fromDevRev.filesToLoad.length
      ) {
        console.warn('No files to load, returning.');
        return {
          reports: this.reports,
          processed_files: this.processedFiles,
        };
      }

      console.log(
        'Files to load in state',
        this.adapterState.sdkState.fromDevRev?.filesToLoad
      );

      try {
        outerloop: for (const fileToLoad of this.adapterState.sdkState
          .fromDevRev.filesToLoad) {
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
            const { response, error: transformerFileError } =
              await this.uploader.getJsonObjectByArtifactId({
                artifactId: fileToLoad.id,
                isGzipped: true,
              });

            if (transformerFileError) {
              console.error(
                `Transformer file not found for artifact ID: ${fileToLoad.id}.`
              );
              await this.emit(LoaderEventType.DataLoadingError, {
                error: {
                  message: `Transformer file not found for artifact ID: ${fileToLoad.id}.`,
                },
              });
              break outerloop;
            }

            const transformerFile = response as ExternalSystemItem[];

            for (let i = fileToLoad.lineToProcess; i < fileToLoad.count; i++) {
              if (this.isTimeout) {
                console.log(
                  'Timeout detected during data loading. Emitting progress to allow continuation.'
                );
                await this.emit(LoaderEventType.DataLoadingProgress);
                process.exit(0);
              }

              const { report, rateLimit } = await this.loadItem({
                item: transformerFile[i],
                itemTypeToLoad,
              });

              if (rateLimit?.delay) {
                await this.emit(LoaderEventType.DataLoadingDelayed, {
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
      } catch (error) {
        console.error('Error during data loading.', serializeError(error));
        await this.emit(LoaderEventType.DataLoadingError, {
          error: {
            message: `Error during data loading. ${serializeError(error)}`,
          },
        });
        process.exit(1);
      }

      return {
        reports: this.reports,
        processed_files: this.processedFiles,
      };
    });
  }

  async getLoaderBatches({
    supportedItemTypes,
  }: {
    supportedItemTypes: string[];
  }) {
    return runWithSdkLogContext(async () => {
      const statsFileArtifactId = this.event.payload.event_data?.stats_file;

      if (statsFileArtifactId) {
        const { response, error: statsFileError } =
          await this.uploader.getJsonObjectByArtifactId({
            artifactId: statsFileArtifactId,
          });

        const statsFile = response as StatsFileObject[];

        if (statsFileError || statsFile.length === 0) {
          return [] as FileToLoad[];
        }

        const filesToLoad = getFilesToLoad({
          supportedItemTypes,
          statsFile,
        });

        return filesToLoad;
      }

      return [] as FileToLoad[];
    });
  }

  async loadAttachments({
    create,
  }: {
    create: ExternalSystemLoadingFunction<ExternalSystemAttachment>;
  }): Promise<LoadItemTypesResponse> {
    return runWithSdkLogContext(async () => {
      if (this.event.payload.event_type === EventType.StartLoadingAttachments) {
        this.adapterState.sdkState.fromDevRev = {
          filesToLoad: await this.getLoaderBatches({
            supportedItemTypes: ['attachment'],
          }),
        };
      }

      if (
        !this.adapterState.sdkState.fromDevRev ||
        this.adapterState.sdkState.fromDevRev?.filesToLoad.length === 0
      ) {
        console.log('No files to load, returning.');
        return {
          reports: this.reports,
          processed_files: this.processedFiles,
        };
      }

      const filesToLoad = this.adapterState.sdkState.fromDevRev?.filesToLoad;

      try {
        outerloop: for (const fileToLoad of filesToLoad) {
          if (!fileToLoad.completed) {
            const { response, error: transformerFileError } =
              await this.uploader.getJsonObjectByArtifactId({
                artifactId: fileToLoad.id,
                isGzipped: true,
              });

            const transformerFile = response as ExternalSystemAttachment[];

            if (transformerFileError) {
              console.error(
                `Transformer file not found for artifact ID: ${fileToLoad.id}.`
              );
              await this.emit(LoaderEventType.AttachmentLoadingError, {
                error: {
                  message: `Transformer file not found for artifact ID: ${fileToLoad.id}.`,
                },
              });
              break outerloop;
            }

            for (let i = fileToLoad.lineToProcess; i < fileToLoad.count; i++) {
              if (this.isTimeout) {
                console.log(
                  'Timeout detected during attachment loading. Emitting progress to allow continuation.'
                );
                await this.emit(LoaderEventType.AttachmentLoadingProgress);
                process.exit(0);
              }

              const { report, rateLimit } = await this.loadAttachment({
                item: transformerFile[i],
                create,
              });

              if (rateLimit?.delay) {
                await this.emit(LoaderEventType.AttachmentLoadingDelayed, {
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
      } catch (error) {
        console.error(
          'Error during attachment loading.',
          serializeError(error)
        );
        await this.emit(LoaderEventType.AttachmentLoadingError, {
          error: {
            message: `Error during attachment loading. ${serializeError(
              error
            )}`,
          },
        });
        process.exit(1);
      }

      return {
        reports: this.reports,
        processed_files: this.processedFiles,
      };
    });
  }

  async loadItem({
    item,
    itemTypeToLoad,
  }: {
    item: ExternalSystemItem;
    itemTypeToLoad: ItemTypeToLoad;
  }): Promise<LoadItemResponse> {
    return runWithSdkLogContext(async () => {
      const devrevId = item.id.devrev;

      try {
        const syncMapperRecordResponse = await this._mappers.getByTargetId({
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
        const { id, modifiedDate, delay, error } = await runWithUserLogContext(
          async () => {
            return await itemTypeToLoad.update({
              item,
              mappers: this._mappers,
              event: this.event,
            });
          }
        );

        if (id) {
          try {
            const syncMapperRecordUpdateResponse = await this._mappers.update({
              id: syncMapperRecord.sync_mapper_record.id,
              sync_unit: this.event.payload.event_context.sync_unit,
              status: SyncMapperRecordStatus.OPERATIONAL,
              ...(modifiedDate && {
                external_versions: {
                  add: [
                    {
                      modified_date: modifiedDate,
                      recipe_version: 0,
                    },
                  ],
                },
              }),
              external_ids: {
                add: [id],
              },
              targets: {
                add: [devrevId],
              },
            });

            console.log(
              'Successfully updated sync mapper record.',
              syncMapperRecordUpdateResponse.data
            );
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
            const { id, modifiedDate, delay, error } =
              await runWithUserLogContext(async () => {
                return await itemTypeToLoad.create({
                  item,
                  mappers: this._mappers,
                  event: this.event,
                });
              });

            if (id) {
              // Create mapper
              try {
                const syncMapperRecordCreateResponse =
                  await this._mappers.create({
                    sync_unit: this.event.payload.event_context.sync_unit,
                    status: SyncMapperRecordStatus.OPERATIONAL,
                    external_ids: [id],
                    targets: [devrevId],
                    ...(modifiedDate && {
                      external_versions: [
                        {
                          modified_date: modifiedDate,
                          recipe_version: 0,
                        },
                      ],
                    }),
                  });

                console.log(
                  'Successfully created sync mapper record.',
                  syncMapperRecordCreateResponse.data
                );

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

        console.warn(
          'Failed to get sync mapper record.',
          serializeError(error)
        );
        return {
          error: {
            message:
              'Failed to get sync mapper record. ' + serializeError(error),
          },
        };
      }
    });
  }

  async loadAttachment({
    item,
    create,
  }: {
    item: ExternalSystemAttachment;
    create: ExternalSystemLoadingFunction<ExternalSystemAttachment>;
  }): Promise<LoadItemResponse> {
    return runWithSdkLogContext(async () => {
      // Create item
      const { id, delay, error } = await runWithUserLogContext(async () =>
        create({
          item,
          mappers: this._mappers,
          event: this.event,
        })
      );

      if (delay) {
        return {
          rateLimit: {
            delay,
          },
        };
      } else if (id) {
        try {
          const syncMapperRecordCreateResponse = await this._mappers.create({
            sync_unit: this.event.payload.event_context.sync_unit,
            external_ids: [id],
            targets: [item.reference_id],
            status: SyncMapperRecordStatus.OPERATIONAL,
          });

          console.log(
            'Successfully created sync mapper record.',
            syncMapperRecordCreateResponse.data
          );
        } catch (error) {
          console.warn(
            'Failed to create sync mapper record.',
            serializeError(error)
          );
        }

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
    });
  }
}
