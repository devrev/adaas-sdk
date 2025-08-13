import {
  NormalizedAttachment,
  ExternalSystemAttachmentStreamingFunction,
  ProcessAttachmentReturnType
} from '../types';
import { AttachmentsStreamingPoolParams } from './attachments-streaming-pool.interfaces';
import { WorkerAdapter } from '../workers/worker-adapter';

export class AttachmentsStreamingPool<ConnectorState> {
  private adapter: WorkerAdapter<ConnectorState>;
  private attachments: NormalizedAttachment[];
  private batchSize: number;
  private delay: number | undefined;
  private stream: ExternalSystemAttachmentStreamingFunction;

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
      if (this.delay) {
        break; // Exit if we have a delay
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
        console.log(
          `Attachment with ID ${attachment.id} has already been processed. Skipping.`
        );
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

        // No rate limiting, process normally
        if (
          this.adapter.state.toDevRev?.attachmentsMetadata
            ?.lastProcessedAttachmentsIdsList
        ) {
          this.adapter.state.toDevRev?.attachmentsMetadata.lastProcessedAttachmentsIdsList.push(
            attachment.id
          );
          console.log(`Successfully processed attachment: ${attachment.id}`);
        }
      } catch (error) {
        console.warn(
          `Skipping attachment with ID ${attachment.id} due to error: ${error}`
        );
      }
    }
  }
}