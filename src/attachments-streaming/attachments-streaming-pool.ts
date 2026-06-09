import { sleep } from '../common/helpers';
import { ExtractionAdapter } from '../multithreading/adapters/extraction-adapter';
import { ProcessedAttachment } from '../state/state.interfaces';
import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
  ProcessAttachmentReturnType,
} from '../types';
import { AttachmentsStreamingPoolParams } from './attachments-streaming-pool.interfaces';

/**
 * Concurrency-bounded pool that streams a batch of attachments from the external system to DevRev.
 *
 * Used during attachment extraction to download up to batchSize attachments in parallel while honoring
 * timeouts, rate-limit delays, and per-attachment errors, and to track processed attachments for resumption.
 */
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

  /**
   * Increments the processed counter and periodically logs progress.
   *
   * Used after each attachment to report progress every PROGRESS_REPORT_INTERVAL items and briefly
   * yield the event loop.
   *
   * @returns Promise that resolves once progress has been recorded (and any brief sleep elapsed).
   */
  private async updateProgress() {
    this.totalProcessedCount++;
    if (this.totalProcessedCount % this.PROGRESS_REPORT_INTERVAL === 0) {
      console.info(`Processed ${this.totalProcessedCount} attachments so far.`);
      // Sleep for 100ms to avoid blocking the event loop
      await sleep(100);
    }
  }

  /**
   * Migrates processed-attachment state from the legacy string[] format to ProcessedAttachment[].
   *
   * Used when resuming streaming so older saved state (a list of ids) is upgraded to the structured
   * { id, parent_id } form before it is consulted for de-duplication.
   *
   * @param attachments - The persisted list to migrate, either a string[] of ids or a ProcessedAttachment[].
   * @returns Migrated array of ProcessedAttachment objects, or an empty array if the input is invalid.
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

  /**
   * Streams every attachment in the pool, running up to batchSize streams concurrently.
   *
   * Used as the pool's entry point: it initializes/migrates the processed-attachments state, starts the
   * initial set of worker loops, and waits for them to drain the queue or stop early on a delay.
   *
   * @returns Promise resolving to a ProcessAttachmentReturnType: a delay if rate-limited, an error if
   * state is uninitialized, or an empty object once all attachments are processed.
   */
  async streamAll(): Promise<ProcessAttachmentReturnType> {
    console.log(
      `Starting download of ${this.attachments.length} attachments, streaming ${this.batchSize} at once.`
    );

    if (!this.adapter.sdkState.toDevRev) {
      const error = new Error('toDevRev state is not initialized');
      console.error(error);
      return { error };
    }

    // Get the list of successfully processed attachments in previous (possibly incomplete) batch extraction.
    // If no such list exists, create an empty one.
    if (
      !this.adapter.sdkState.toDevRev.attachmentsMetadata
        .lastProcessedAttachmentsIdsList
    ) {
      this.adapter.sdkState.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList =
        [];
    }

    // Migrate old processed attachments to the new format.
    this.adapter.sdkState.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList =
      this.migrateProcessedAttachments(
        this.adapter.sdkState.toDevRev.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      );

    // Start initial batch of promises up to batchSize limit
    const initialBatchSize = Math.min(this.batchSize, this.attachments.length);
    const initialPromises = [];

    for (let i = 0; i < initialBatchSize; i++) {
      initialPromises.push(this.startPoolStreaming());
    }

    // Wait for all promises to complete
    await Promise.all(initialPromises);

    if (this.delay) {
      return { delay: this.delay };
    }

    return {};
  }

  /**
   * Runs a single worker loop that pulls and streams attachments until the queue is drained.
   *
   * Used as one of the concurrent workers started by streamAll: it skips already-processed attachments,
   * stops on timeout or a rate-limit delay, records successes, and logs/skips per-attachment errors.
   *
   * @returns Promise that resolves when this worker stops, either because the queue is empty or a
   * timeout/delay was detected.
   */
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
        this.adapter.sdkState.toDevRev &&
        this.adapter.sdkState.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList?.some(
          (it) => it.id == attachment.id && it.parent_id == attachment.parent_id
        )
      ) {
        continue; // Skip if the attachment ID is already processed
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

          console.warn(
            `Skipping attachment with ID ${attachment.id} with extension ${fileExtension} ${fileSizeInfo}${contentTypeInfo}due to error returned by the stream function`,
            response.error.message
          );
          await this.updateProgress();
          continue;
        }

        // No rate limiting, process normally
        if (
          this.adapter.sdkState.toDevRev?.attachmentsMetadata
            ?.lastProcessedAttachmentsIdsList
        ) {
          this.adapter.sdkState.toDevRev?.attachmentsMetadata.lastProcessedAttachmentsIdsList.push(
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
          `Skipping attachment with ID ${attachment.id} with extension ${fileExtension}${contentTypeInfo} due to error in processAttachment function`,
          error
        );

        await this.updateProgress();
      }
    }
  }
}
