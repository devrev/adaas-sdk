import { AttachmentsStreamingPool } from '../../attachments-streaming/attachments-streaming-pool';
import {
  AirSyncDefaultItemTypes,
  EVENT_SIZE_THRESHOLD_BYTES,
  SSOR_ATTACHMENT,
} from '../../common/constants';
import { serializeError } from '../../logger/logger';
import { Repo } from '../../repo/repo';
import {
  NormalizedAttachment,
  RepoInterface,
} from '../../repo/repo.interfaces';
import { BaseState } from '../../state/state';
import {
  AirSyncEvent,
  EventData,
  ExternalSystemAttachmentProcessors,
  ExternalSystemAttachmentStreamingFunction,
  ExtractorEventType,
  HttpStreamResponse,
  ItemTypeCount,
  ProcessAttachmentReturnType,
  WorkerMetadata,
} from '../../types/extraction';
import { LoaderEventType } from '../../types/loading';
import { TaskResult, WorkerAdapterOptions } from '../../types/workers';
import { Artifact, SsorAttachment } from '../../uploader/uploader.interfaces';

import { BaseAdapter } from './base-adapter';

/** Adapter passed to extraction tasks (repos, artifacts, attachment streaming). @public */
export class ExtractionAdapter<
  ConnectorState
> extends BaseAdapter<ConnectorState> {
  private _artifacts: Artifact[];
  private _preExtractionItemCounts?: ItemTypeCount[];
  private repos: Repo[] = [];
  private lastExtractedItemType?: string;
  private currentEventDataLength: number = 0;

  constructor(params: {
    event: AirSyncEvent;
    adapterState: BaseState<ConnectorState>;
    options?: WorkerAdapterOptions;
  }) {
    super(params);
    this._artifacts = [];
  }

  /** Defaults to true if the scope is empty or the item type is not listed. */
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
          this.lastExtractedItemType = repo.itemType;

          // Artifact ids are kept in state for later attachment streaming
          if (repo.itemType === AirSyncDefaultItemTypes.ATTACHMENTS) {
            this.sdkState.toDevRev?.attachmentsMetadata.artifactIds.push(
              artifact.id
            );
          }

          // Track size of artifact objects that go in the SQS message; flip
          // isTimeout once the threshold is exceeded to force an early emit.
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
    const repo = this.repos.find((repo) => repo.itemType === itemType);

    if (!repo) {
      console.error(`Repo for item type ${itemType} not found.`);
      return;
    }

    return repo;
  }

  get artifacts(): Artifact[] {
    return this._artifacts;
  }

  set artifacts(artifacts: Artifact[]) {
    this._artifacts = this._artifacts
      .concat(artifacts)
      .filter((value, index, self) => self.indexOf(value) === index);
  }

  get preExtractionItemCounts(): ItemTypeCount[] | undefined {
    return this._preExtractionItemCounts;
  }

  /**
   * Per-record-type counts for sync-duration estimation. Set during the
   * metadata phase; the SDK attaches them to the metadata-done event.
   */
  set preExtractionItemCounts(counts: ItemTypeCount[] | undefined) {
    this._preExtractionItemCounts = counts;
  }

  protected async beforeEmit(
    newEventType: ExtractorEventType | LoaderEventType
  ): Promise<void> {
    console.log(
      `Uploading all repos before emitting event with event type: ${newEventType}.`
    );
    await this.uploadAllRepos();

    // When the full extraction cycle completes, commit the extraction window
    // boundaries so subsequent incremental syncs can resume from them.
    if (newEventType === ExtractorEventType.AttachmentExtractionDone) {
      const sdkState = this.sdkState;

      sdkState.pendingWorkersOldest = '';
      sdkState.pendingWorkersNewest = '';

      // Expand boundaries: workersOldest keeps the earliest timestamp seen,
      // workersNewest the latest.
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

    if (!isExtractionEvent) {
      return {};
    }

    const payload: EventData = { artifacts: this.artifacts };

    if (
      newEventType === ExtractorEventType.MetadataExtractionDone &&
      this._preExtractionItemCounts
    ) {
      payload.pre_extraction_item_counts = this._preExtractionItemCounts;
    }

    return payload;
  }

  /**
   * Attaches the last-extracted item type and its created/modified date ranges
   * to data/attachment done/progress events, mirroring the metadata v1 sent.
   */
  protected override buildWorkerMetadata(
    newEventType: ExtractorEventType | LoaderEventType
  ): WorkerMetadata | undefined {
    if (
      newEventType !== ExtractorEventType.DataExtractionDone &&
      newEventType !== ExtractorEventType.DataExtractionProgress &&
      newEventType !== ExtractorEventType.AttachmentExtractionDone &&
      newEventType !== ExtractorEventType.AttachmentExtractionProgress
    ) {
      return undefined;
    }

    const repo = this.lastExtractedItemType
      ? this.repos.find((r) => r.itemType === this.lastExtractedItemType)
      : undefined;

    if (!repo) {
      return undefined;
    }

    return {
      item_type: repo.itemType,
      newest_created_date: this.toRfc3339Timestamp(
        repo.dateRanges.creationDate.newest
      ),
      oldest_created_date: this.toRfc3339Timestamp(
        repo.dateRanges.creationDate.oldest
      ),
      newest_modified_date: this.toRfc3339Timestamp(
        repo.dateRanges.modifiedDate.newest
      ),
      oldest_modified_date: this.toRfc3339Timestamp(
        repo.dateRanges.modifiedDate.oldest
      ),
    };
  }

  private toRfc3339Timestamp(ms?: number): string | undefined {
    if (ms === undefined || !Number.isFinite(ms)) {
      return undefined;
    }

    return new Date(ms).toISOString();
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
    const { httpStream, delay, error } = await stream({
      item: attachment,
      event: this.event,
    });

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

      // Set inline flag only if it is explicitly set on the attachment.
      if (attachment.inline === true) {
        ssorAttachment.inline = true;
      } else if (attachment.inline === false) {
        ssorAttachment.inline = false;
      }

      if (this.isTimeout) {
        this.destroyHttpStream(httpStream);
        return;
      }

      await this.getRepo('ssor_attachment')?.push([ssorAttachment]);
      return;
    }
    return {
      error: {
        message: `Error while opening attachment stream. Skipping attachment.`,
      },
    };
  }

  /** Destroys a stream to prevent memory leaks. */
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

  async streamAttachments<NewBatch>({
    stream,
    processors,
    batchSize = 1,
  }: {
    stream: ExternalSystemAttachmentStreamingFunction;
    processors?: ExternalSystemAttachmentProcessors<
      ConnectorState,
      NormalizedAttachment[],
      NewBatch
    >;
    batchSize?: number;
  }): Promise<TaskResult> {
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

    if (!attachmentsMetadata?.artifactIds?.length) {
      console.log(`No attachments metadata artifact IDs found in state.`);
      return { status: 'success' };
    } else {
      console.log(
        `Found ${attachmentsMetadata.artifactIds.length} attachments metadata artifact IDs in state.`
      );
    }

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
        return { status: 'error', error };
      }

      if (!attachments || attachments.length === 0) {
        console.warn(
          `No attachments found for artifact ID: ${attachmentsMetadataArtifactId}.`
        );
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

      if (response?.error) {
        return { status: 'error', error: response.error };
      }

      if (response?.delay) {
        return { status: 'delay', delaySeconds: response.delay };
      }

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
  }
}
