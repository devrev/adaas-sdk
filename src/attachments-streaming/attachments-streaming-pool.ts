import { sleep } from '../common/helpers';
import { WorkerAdapter } from '../multithreading/worker-adapter/worker-adapter';
import {
  FailedAttachment,
  ProcessedAttachment,
} from '../state/state.interfaces';
import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
  ProcessAttachmentReturnType,
} from '../types';
import { AttachmentsStreamingPoolParams } from './attachments-streaming-pool.interfaces';

export class AttachmentsStreamingPool<ConnectorState> {
  private adapter: WorkerAdapter<ConnectorState>;
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

  /**
   * Marks an attachment as permanently failed after a transient error (ECONNABORTED,
   * 5xx), so subsequent invocations skip it instead of retrying a deterministically-
   * failing request forever. The stream function's own HTTP client (axiosClient) already
   * retries transient errors with exponential backoff before returning one here, so a
   * second retry loop at this level would just double up on an already-exhausted budget.
   */
  private markPermanentlyFailed(attachment: NormalizedAttachment): void {
    const attachmentsMetadata =
      this.adapter.state.toDevRev?.attachmentsMetadata;
    if (!attachmentsMetadata) {
      return;
    }

    const failedAttachmentsIdsList: FailedAttachment[] =
      attachmentsMetadata.failedAttachmentsIdsList ?? [];
    attachmentsMetadata.failedAttachmentsIdsList = failedAttachmentsIdsList;

    const alreadyMarked = failedAttachmentsIdsList.some(
      (it) => it.id === attachment.id && it.parent_id === attachment.parent_id
    );
    if (!alreadyMarked) {
      failedAttachmentsIdsList.push({
        id: attachment.id,
        parent_id: attachment.parent_id,
      });
    }
  }

  private async updateProgress() {
    this.totalProcessedCount++;
    if (this.totalProcessedCount % this.PROGRESS_REPORT_INTERVAL === 0) {
      console.info(`Processed ${this.totalProcessedCount} attachments so far.`);
      // Sleep for 100ms to avoid blocking the event loop
      await sleep(100);
    }
  }

  /**
   * Migrates processed attachments from the legacy string[] format to the new ProcessedAttachment[] format.
   *
   * @param attachments - The attachments list to migrate (either string[] or ProcessedAttachment[])
   * @returns Migrated array of ProcessedAttachment objects, or empty array if input is invalid
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private migrateProcessedAttachments(attachments: any): ProcessedAttachment[] {
    // Handle null/undefined
    if (!attachments || !Array.isArray(attachments)) {
      return [];
    }

    // If already migrated (first element is an object), return as-is
    if (attachments.length > 0 && typeof attachments[0] === 'object') {
      return attachments as ProcessedAttachment[];
    }

    // Migrate old string[] format
    if (attachments.length > 0 && typeof attachments[0] === 'string') {
      return attachments.map((it) => ({
        id: it as string,
        parent_id: '',
      }));
    }

    return [];
  }

  async streamAll(): Promise<ProcessAttachmentReturnType> {
    console.log(
      `Starting download of ${this.attachments.length} attachments, streaming ${this.batchSize} at once.`
    );

    if (!this.adapter.state.toDevRev) {
      const error = new Error('toDevRev state is not initialized');
      console.error(error);
      return { error };
    }

    // Get the list of successfully processed attachments in previous (possibly incomplete) batch extraction.
    // If no such list exists, create an empty one.
    if (
      !this.adapter.state.toDevRev.attachmentsMetadata
        .lastProcessedAttachmentsIdsList
    ) {
      this.adapter.state.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList =
        [];
    }

    // Migrate old processed attachments to the new format.
    this.adapter.state.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList =
      this.migrateProcessedAttachments(
        this.adapter.state.toDevRev.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      );

    // Get the list of attachments that have repeatedly failed with a transient error in
    // previous invocations. If no such list exists, create an empty one.
    if (
      !this.adapter.state.toDevRev.attachmentsMetadata.failedAttachmentsIdsList
    ) {
      this.adapter.state.toDevRev.attachmentsMetadata.failedAttachmentsIdsList =
        [];
    }

    // Start initial batch of promises up to batchSize limit
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
    // Process attachments until the attachments array is empty
    while (this.attachments.length > 0) {
      // If delay is set, stop streaming
      if (this.delay) {
        break;
      }

      // If timeout is set, stop streaming
      if (this.adapter.isTimeout) {
        console.log(
          'Timeout detected while streaming attachments. Stopping streaming.'
        );
        break;
      }

      // Check if we can process next attachment
      const attachment = this.attachments.shift();

      if (!attachment) {
        break; // Exit if no more attachments
      }

      if (
        this.adapter.state.toDevRev &&
        this.adapter.state.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList?.some(
          (it) => it.id == attachment.id && it.parent_id == attachment.parent_id
        )
      ) {
        continue; // Skip if the attachment ID is already processed
      }

      if (
        this.adapter.state.toDevRev &&
        this.adapter.state.toDevRev.attachmentsMetadata.failedAttachmentsIdsList?.some(
          (it) => it.id == attachment.id && it.parent_id == attachment.parent_id
        )
      ) {
        console.warn(
          `Skipping attachment with ID ${attachment.id} fetched from URL ${attachment.url}: previously failed with a transient error.`
        );
        continue; // Skip if the attachment was already marked as permanently failed
      }

      try {
        const response = await this.adapter.processAttachment(
          attachment,
          this.stream
        );

        // Check if rate limit was hit
        if (response?.delay) {
          this.delay = response.delay; // Set the delay for rate limiting
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

          const fetchHeadersInfo =
            response.error.fetchHeaders &&
            Object.keys(response.error.fetchHeaders).length > 0
              ? `and fetch response headers ${JSON.stringify(
                  response.error.fetchHeaders
                )} `
              : '';

          console.warn(
            `Skipping attachment with ID ${attachment.id} with extension ${fileExtension} ${fileSizeInfo}${contentTypeInfo}${fetchHeadersInfo}fetched from URL ${attachment.url} due to error returned by the stream function`,
            response.error.message
          );

          // The stream function's HTTP client already retried this request with
          // exponential backoff before returning an error, so a transient failure here
          // means that budget is exhausted — mark it permanently failed rather than
          // retrying it again from scratch next invocation.
          if (response.error.isTransient) {
            this.markPermanentlyFailed(attachment);
          }

          await this.updateProgress();
          continue;
        }

        if (
          !this.adapter.isTimeout &&
          this.adapter.state.toDevRev?.attachmentsMetadata
            ?.lastProcessedAttachmentsIdsList
        ) {
          this.adapter.state.toDevRev?.attachmentsMetadata.lastProcessedAttachmentsIdsList.push(
            { id: attachment.id, parent_id: attachment.parent_id }
          );
        }

        await this.updateProgress();
      } catch (error) {
        const fileExtension = attachment.file_name.split('.').pop() || '';

        const contentTypeInfo = attachment.content_type
          ? ` and content_type ${attachment.content_type}`
          : '';

        console.warn(
          `Skipping attachment with ID ${attachment.id} with extension ${fileExtension}${contentTypeInfo} fetched from URL ${attachment.url} due to error in processAttachment function`,
          error
        );

        await this.updateProgress();
      }
    }
  }
}
