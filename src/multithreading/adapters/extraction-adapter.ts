import { AttachmentsStreamingPool } from '../../attachments-streaming/attachments-streaming-pool';
import {
  AirSyncDefaultItemTypes,
  EVENT_SIZE_THRESHOLD_BYTES,
  SSOR_ATTACHMENT,
} from '../../common/constants';
import { serializeError } from '../../logger/logger';
import {
  runWithSdkLogContext,
  runWithUserLogContext,
} from '../../logger/logger.context';
import { Repo } from '../../repo/repo';
import {
  NormalizedAttachment,
  RepoInterface,
} from '../../repo/repo.interfaces';
import {
  AirSyncEvent,
  EventData,
  ExternalSystemAttachmentProcessors,
  ExternalSystemAttachmentStreamingFunction,
  ExtractorEventType,
  HttpStreamResponse,
  ProcessAttachmentReturnType,
} from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';
import { BaseState } from '../../state/state';
import { TaskResult, WorkerAdapterOptions } from '../../types/workers';
import { Artifact, SsorAttachment } from '../../uploader/uploader.interfaces';

import { BaseAdapter } from './base-adapter';

/**
 * ExtractionAdapter is the adapter passed to extraction tasks. It exposes the
 * extraction surface (repos, artifacts, attachment streaming) and uploads
 * pending repos and updates the extraction boundaries before emitting.
 *
 * @public
 */
export class ExtractionAdapter<
  ConnectorState
> extends BaseAdapter<ConnectorState> {
  private _artifacts: Artifact[];
  private repos: Repo[] = [];
  private currentEventDataLength: number = 0;

  constructor(params: {
    event: AirSyncEvent;
    adapterState: BaseState<ConnectorState>;
    options?: WorkerAdapterOptions;
  }) {
    super(params);
    this._artifacts = [];
  }

  /**
   * Returns whether the given item type should be extracted.
   * Defaults to true if the scope is empty or the item type is not listed.
   */
  shouldExtract(itemType: string): boolean {
    const scope = this.extractionScope;
    if (Object.keys(scope).length === 0) return true;
    if (!(itemType in scope)) return true;
    return scope[itemType].extract;
  }

  initializeRepos(repos: RepoInterface[]) {
    this.repos = repos.map((repo) => {
      const shouldNormalize =
        repo.itemType !== AirSyncDefaultItemTypes.EXTERNAL_DOMAIN_METADATA &&
        repo.itemType !== SSOR_ATTACHMENT;

      return new Repo({
        event: this.event,
        itemType: repo.itemType,
        ...(shouldNormalize && { normalize: repo.normalize }),
        onUpload: (artifact: Artifact) => {
          // We need to store artifacts ids in state for later use when streaming attachments
          if (repo.itemType === AirSyncDefaultItemTypes.ATTACHMENTS) {
            this.sdkState.toDevRev?.attachmentsMetadata.artifactIds.push(
              artifact.id
            );
          }

          // Calculate size of the entire artifact object that goes in the SQS message
          this.currentEventDataLength += Buffer.byteLength(
            JSON.stringify(artifact),
            'utf8'
          );

          if (
            this.currentEventDataLength > EVENT_SIZE_THRESHOLD_BYTES &&
            !this.isTimeout
          ) {
            this.isTimeout = true;
          }
        },
        options: {
          ...this.options,
          ...repo.overridenOptions,
        },
      });
    });
  }

  getRepo(itemType: string): Repo | undefined {
    return runWithSdkLogContext(() => {
      const repo = this.repos.find((repo) => repo.itemType === itemType);

      if (!repo) {
        console.error(`Repo for item type ${itemType} not found.`);
        return;
      }

      return repo;
    });
  }

  get artifacts(): Artifact[] {
    return this._artifacts;
  }

  set artifacts(artifacts: Artifact[]) {
    this._artifacts = this._artifacts
      .concat(artifacts)
      .filter((value, index, self) => self.indexOf(value) === index);
  }

  protected async beforeEmit(
    newEventType: ExtractorEventType | LoaderEventType
  ): Promise<void> {
    // Upload all repos before emitting the event
    console.log(
      `Uploading all repos before emitting event with event type: ${newEventType}.`
    );
    await this.uploadAllRepos();

    // If the extraction is done, we want to save the timestamp of the last successful sync
    if (newEventType === ExtractorEventType.AttachmentExtractionDone) {
      const sdkState = this.sdkState;

      console.log(
        `Overwriting lastSuccessfulSyncStarted with lastSyncStarted (${sdkState.lastSyncStarted}).`
      );

      sdkState.lastSuccessfulSyncStarted = sdkState.lastSyncStarted;
      sdkState.lastSyncStarted = '';

      // Clear pending extraction boundaries now that the cycle is complete
      sdkState.pendingWorkersOldest = '';
      sdkState.pendingWorkersNewest = '';

      // Update workersOldest and workersNewest boundaries from resolved extraction timestamps.
      // Expand boundaries: workersOldest gets the earliest timestamp, workersNewest gets the latest.
      const extractionStart = this.event.payload.event_context.extract_from;
      const extractionEnd = this.event.payload.event_context.extract_to;

      if (
        extractionStart &&
        (!sdkState.workersOldest || extractionStart < sdkState.workersOldest)
      ) {
        console.log(
          `Updating workersOldest from '${sdkState.workersOldest}' to '${extractionStart}'.`
        );
        sdkState.workersOldest = extractionStart;
      }

      if (
        extractionEnd &&
        (!sdkState.workersNewest || extractionEnd > sdkState.workersNewest)
      ) {
        console.log(
          `Updating workersNewest from '${sdkState.workersNewest}' to '${extractionEnd}'.`
        );
        sdkState.workersNewest = extractionEnd;
      }
    }
  }

  protected buildEmitPayload(
    newEventType: ExtractorEventType | LoaderEventType
  ): EventData {
    const isExtractionEvent = Object.values(ExtractorEventType).includes(
      newEventType as ExtractorEventType
    );
    return isExtractionEvent ? { artifacts: this.artifacts } : {};
  }

  protected afterEmit(): void {
    this.artifacts = [];
  }

  async uploadAllRepos(): Promise<void> {
    for (const repo of this.repos) {
      const error = await repo.upload();
      this.artifacts.push(...repo.uploadedArtifacts);
      if (error) {
        throw error;
      }
    }
  }

  async processAttachment(
    attachment: NormalizedAttachment,
    stream: ExternalSystemAttachmentStreamingFunction
  ): Promise<ProcessAttachmentReturnType> {
    return runWithSdkLogContext(async () => {
      const { httpStream, delay, error } = await runWithUserLogContext(
        async () =>
          stream({
            item: attachment,
            event: this.event,
          })
      );

      if (error) {
        return { error };
      } else if (delay) {
        return { delay };
      }

      if (httpStream) {
        const fileType =
          attachment.content_type ||
          httpStream.headers['content-type']?.toString() ||
          'application/octet-stream';
        const contentLength = httpStream.headers['content-length']?.toString();
        const fileSize = contentLength ? parseInt(contentLength) : undefined;

        // Get upload URL
        const { error: artifactUrlError, response: artifactUrlResponse } =
          await this.uploader.getArtifactUploadUrl(
            attachment.file_name,
            fileType,
            fileSize
          );

        if (artifactUrlError) {
          this.destroyHttpStream(httpStream);
          return {
            error: {
              message: `Error while preparing artifact for attachment ID ${
                attachment.id
              }. Skipping attachment. ${serializeError(artifactUrlError)}`,
              fileSize: fileSize,
            },
          };
        }

        // Stream attachment
        const { error: uploadedArtifactError } =
          await this.uploader.streamArtifact(artifactUrlResponse!, httpStream);

        if (uploadedArtifactError) {
          this.destroyHttpStream(httpStream);
          return {
            error: {
              message:
                `Error while streaming to artifact for attachment ID ${attachment.id}. Skipping attachment. ` +
                serializeError(uploadedArtifactError),
              fileSize: fileSize,
            },
          };
        }

        // Confirm attachment upload
        const { error: confirmArtifactUploadError } =
          await this.uploader.confirmArtifactUpload(
            artifactUrlResponse!.artifact_id
          );
        if (confirmArtifactUploadError) {
          return {
            error: {
              message:
                `Error while confirming upload for attachment ID ${attachment.id}. ` +
                serializeError(confirmArtifactUploadError),
              fileSize: fileSize,
            },
          };
        }

        const ssorAttachment: SsorAttachment = {
          id: {
            devrev: artifactUrlResponse!.artifact_id,
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
        return;
      }
      return {
        error: {
          message: `Error while opening attachment stream. Skipping attachment.`,
        },
      };
    });
  }

  /**
   * Destroys a stream to prevent memory leaks.
   * @param httpStream - The axios response stream to destroy
   */
  private destroyHttpStream(httpStream: HttpStreamResponse): void {
    try {
      if (httpStream && httpStream.data) {
        if (typeof httpStream.data.destroy === 'function') {
          httpStream.data.destroy();
        } else if (typeof httpStream.data.close === 'function') {
          httpStream.data.close();
        }
      }
    } catch (error) {
      console.warn('Error while destroying HTTP stream:', error);
    }
  }

  /**
   * Streams the attachments to the DevRev platform.
   * The attachments are streamed to the platform and the artifact information is returned.
   * @param params - The parameters to stream the attachments
   * @returns The response object containing the ssorAttachment artifact information
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
  }): Promise<TaskResult> {
    return runWithSdkLogContext(async () => {
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

      const attachmentsMetadata = this.sdkState.toDevRev?.attachmentsMetadata;

      // If there are no attachments metadata artifact IDs in state, finish here
      if (!attachmentsMetadata?.artifactIds?.length) {
        console.log(`No attachments metadata artifact IDs found in state.`);
        return { status: 'success' };
      } else {
        console.log(
          `Found ${attachmentsMetadata.artifactIds.length} attachments metadata artifact IDs in state.`
        );
      }

      // Loop through the attachments metadata artifact IDs
      while (attachmentsMetadata.artifactIds.length > 0) {
        const attachmentsMetadataArtifactId =
          attachmentsMetadata.artifactIds[0];

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
          return { status: 'error', error };
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

          const reducedAttachments = runWithUserLogContext(() =>
            reducer({
              attachments,
              adapter: this,
              batchSize,
            })
          );

          response = await runWithUserLogContext(async () => {
            return await iterator({
              reducedAttachments,
              adapter: this,
              stream,
            });
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

        if (response?.error) {
          return { status: 'error', error: response.error };
        }

        if (response?.delay) {
          return { status: 'delay', delaySeconds: response.delay };
        }

        // On timeout, return progress to allow continuation in a fresh invocation.
        if (this.isTimeout) {
          console.log(
            `Timeout detected after processing attachments for artifact ID: ${attachmentsMetadataArtifactId}. Returning progress to allow continuation.`
          );
          return { status: 'progress' };
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

      return { status: 'success' };
    });
  }
}
