import { yieldToEventLoop } from '../common/helpers';
import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import {
  ProcessedAttachment,
  ProcessedAttachmentStatus,
} from '../state/state.interfaces';
import {
  ExternalSystemAttachmentStreamingFunction,
  ProcessAttachmentReturnType,
} from '../types/extraction';

import { AttachmentsStreamingPoolParams } from './attachments-streaming-pool.interfaces';

export class AttachmentsStreamingPool<ConnectorState> {
  private adapter: ExtractionAdapter<ConnectorState>;
  private attachments: NormalizedAttachment[];
  private batchSize: number;
  private delay: number | undefined;
  private stream: ExternalSystemAttachmentStreamingFunction;

  private totalProcessedCount: number = 0;
  private readonly PROGRESS_REPORT_INTERVAL = 50;

  constructor({
    adapter,
    attachments,
    batchSize = 10,
    stream,
  }: AttachmentsStreamingPoolParams<ConnectorState>) {
    this.adapter = adapter;
    this.attachments = [...attachments]; // Create a copy we can mutate
    this.batchSize = batchSize;
    this.delay = undefined;
    this.stream = stream;
  }

  private recordProcessedAttachment(
    attachment: NormalizedAttachment,
    status: ProcessedAttachmentStatus
  ): void {
    const attachmentsMetadata =
      this.adapter.sdkState.toDevRev?.attachmentsMetadata;
    if (!attachmentsMetadata?.lastProcessedAttachmentsIdsList) {
      return;
    }

    const processedAttachmentsIdsList =
      attachmentsMetadata.lastProcessedAttachmentsIdsList;

    const alreadyRecorded = processedAttachmentsIdsList.some(
      (it) => it.id === attachment.id && it.parent_id === attachment.parent_id
    );
    if (!alreadyRecorded) {
      processedAttachmentsIdsList.push({
        id: attachment.id,
        parent_id: attachment.parent_id,
        status,
      });
    }
  }

  /**
   * Backfills `status` on entries recorded before the field existed (those
   * only ever held successes); state from >= v1.15.2 needs no shape migration.
   */
  private backfillProcessedAttachmentStatus(
    attachments: ProcessedAttachment[]
  ): ProcessedAttachment[] {
    return attachments.map((it) => ({
      ...it,
      status: it.status ?? ProcessedAttachmentStatus.Success,
    }));
  }

  private async updateProgress() {
    this.totalProcessedCount++;
    if (this.totalProcessedCount % this.PROGRESS_REPORT_INTERVAL === 0) {
      console.info(`Processed ${this.totalProcessedCount} attachments so far.`);
      // Let a pending soft-timeout message (WorkerMessageExit) be delivered so
      // adapter.isTimeout can flip before the next batch is processed.
      await yieldToEventLoop();
    }
  }

  async streamAll(): Promise<ProcessAttachmentReturnType> {
    console.log(
      `Starting download of ${this.attachments.length} attachments, streaming ${this.batchSize} at once.`
    );

    if (!this.adapter.sdkState.toDevRev) {
      const error = new Error('toDevRev state is not initialized');
      console.error(error);
      return { error };
    }

    // Attachments processed (successfully or not) by a previous, possibly incomplete, run.
    if (
      !this.adapter.sdkState.toDevRev.attachmentsMetadata
        .lastProcessedAttachmentsIdsList
    ) {
      this.adapter.sdkState.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList =
        [];
    }

    this.adapter.sdkState.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList =
      this.backfillProcessedAttachmentStatus(
        this.adapter.sdkState.toDevRev.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      );

    const initialBatchSize = Math.min(this.batchSize, this.attachments.length);
    const initialPromises = [];

    for (let i = 0; i < initialBatchSize; i++) {
      initialPromises.push(this.startPoolStreaming());
    }

    await Promise.race([
      Promise.all(initialPromises),
      this.adapter.timeoutSignal,
    ]);

    if (this.delay) {
      return { delay: this.delay };
    }

    return {};
  }

  async startPoolStreaming() {
    while (this.attachments.length > 0) {
      if (this.delay) {
        break;
      }

      if (this.adapter.isTimeout) {
        console.log(
          'Timeout detected while streaming attachments. Stopping streaming.'
        );
        break;
      }

      const attachment = this.attachments.shift();

      if (!attachment) {
        break;
      }

      if (
        this.adapter.sdkState.toDevRev &&
        this.adapter.sdkState.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList?.some(
          (it) => it.id == attachment.id && it.parent_id == attachment.parent_id
        )
      ) {
        continue; // Already processed in a previous run
      }

      try {
        const response = await this.adapter.processAttachment(
          attachment,
          this.stream
        );

        // Rate limit hit
        if (response?.delay) {
          this.delay = response.delay;
          return;
        }

        if (response?.error) {
          const fileExtension = attachment.file_name.split('.').pop() || '';

          const fileSizeInfo = response.error.fileSize
            ? `and size ${response.error.fileSize} bytes `
            : '';

          const contentTypeInfo = attachment.content_type
            ? `and content_type ${attachment.content_type} `
            : '';

          console.warn(
            `Skipping attachment with ID ${attachment.id} with extension ${fileExtension} ${fileSizeInfo}${contentTypeInfo}due to error returned by the stream function`,
            response.error.message
          );

          this.recordProcessedAttachment(
            attachment,
            ProcessedAttachmentStatus.Failed
          );

          await this.updateProgress();
          continue;
        }

        if (!this.adapter.isTimeout) {
          this.recordProcessedAttachment(
            attachment,
            ProcessedAttachmentStatus.Success
          );
        }

        await this.updateProgress();
      } catch (error) {
        const fileExtension = attachment.file_name.split('.').pop() || '';

        const contentTypeInfo = attachment.content_type
          ? ` and content_type ${attachment.content_type}`
          : '';

        console.warn(
          `Skipping attachment with ID ${attachment.id} with extension ${fileExtension}${contentTypeInfo} due to error in processAttachment function`,
          error
        );

        await this.updateProgress();
      }
    }
  }
}
