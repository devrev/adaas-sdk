import { sleep } from '../common/helpers';
import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
  ProcessAttachmentReturnType,
} from '../types';
import { WorkerAdapter } from '../multithreading/worker-adapter/worker-adapter';
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

  private async updateProgress() {
    this.totalProcessedCount++;
    if (this.totalProcessedCount % this.PROGRESS_REPORT_INTERVAL === 0) {
      console.info(`Processed ${this.totalProcessedCount} attachments so far.`);
      // Sleep for 100ms to avoid blocking the event loop
      await sleep(100);
    }
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
        this.adapter.state.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList?.includes(
          attachment.id
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
          const file_extension = attachment.file_name.split('.').pop() || '';

          const { message, fileSize } = response.error as {
            message: string;
            fileSize?: number;
          };

          if (fileSize != null) {
            console.warn(
              `Skipping attachment with ID ${attachment.id} with extension ${file_extension} and size ${fileSize} due to error returned by the stream function`,
              message
            );
          } else {
            console.warn(
              `Skipping attachment with ID ${attachment.id} with extension ${file_extension} due to error returned by the stream function`,
              message
            );
          }

          await this.updateProgress();
          continue;
        }

        // No rate limiting, process normally
        if (
          this.adapter.state.toDevRev?.attachmentsMetadata
            ?.lastProcessedAttachmentsIdsList
        ) {
          this.adapter.state.toDevRev?.attachmentsMetadata.lastProcessedAttachmentsIdsList.push(
            attachment.id
          );
        }

        await this.updateProgress();
      } catch (error) {
        const file_extension = attachment.file_name.split('.').pop() || '';

        console.warn(
          `Skipping attachment with ID ${attachment.id} with extension ${file_extension} due to error in processAttachment function`,
          error
        );

        await this.updateProgress();
      }
    }
  }
}
