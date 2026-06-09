import {
  AirSyncDefaultItemTypes,
  ARTIFACT_BATCH_SIZE,
  SSOR_ATTACHMENT,
} from '../common/constants';
import { Item } from '../repo/repo.interfaces';
import { ErrorRecord } from '../types/common';
import { Uploader } from '../uploader/uploader';
import { Artifact } from '../uploader/uploader.interfaces';

import { WorkerAdapterOptions } from '../types/workers';
import { runWithUserLogContext } from '../logger/logger.context';
import {
  NormalizedAttachment,
  NormalizedItem,
  RepoFactoryInterface,
} from './repo.interfaces';

/**
 * In-memory buffer that accumulates normalized items of a single item type during extraction.
 *
 * Used to batch pushed items (ARTIFACT_BATCH_SIZE per batch), normalize them, and upload them as
 * artifacts to the DevRev platform, firing the onUpload callback for each uploaded artifact.
 */
export class Repo {
  readonly itemType: string;
  private items: (NormalizedItem | NormalizedAttachment | Item)[];
  private normalize?: (item: Item) => NormalizedItem | NormalizedAttachment;
  private uploader: Uploader;
  private onUpload: (artifact: Artifact) => void;
  private options?: WorkerAdapterOptions;
  public uploadedArtifacts: Artifact[];

  constructor({
    event,
    itemType,
    normalize,
    onUpload,
    options,
  }: RepoFactoryInterface) {
    this.items = [];
    this.itemType = itemType;
    this.normalize = normalize;
    this.onUpload = onUpload;
    this.uploader = new Uploader({ event, options });
    this.options = options;
    this.uploadedArtifacts = [];
  }

  /** Returns the items currently buffered in the repo (not yet uploaded). */
  getItems(): (NormalizedItem | NormalizedAttachment | Item)[] {
    return this.items;
  }

  /**
   * Uploads a batch of items (or all buffered items) as a single artifact.
   *
   * Used to flush buffered items to the DevRev platform; on success the artifact is passed to
   * onUpload and recorded in uploadedArtifacts. When no explicit batch is given the buffer is cleared.
   *
   * @param batch - Optional explicit array of NormalizedItem, NormalizedAttachment, or Item to upload; defaults to all buffered items.
   * @returns Promise that resolves to void on success, or an ErrorRecord describing the upload failure.
   */
  async upload(
    batch?: (NormalizedItem | NormalizedAttachment | Item)[]
  ): Promise<void | ErrorRecord> {
    const itemsToUpload = batch || this.items;

    if (itemsToUpload.length > 0) {
      console.log(
        `Uploading ${itemsToUpload.length} items of type ${this.itemType}. `
      );

      const { artifact, error } = await this.uploader.upload(
        this.itemType,
        itemsToUpload
      );

      if (error || !artifact) {
        console.error('Error while uploading batch', error);
        return error;
      }

      this.onUpload(artifact);

      this.uploadedArtifacts.push(artifact);

      // Clear the uploaded items from the main items array if no batch was specified
      if (!batch) {
        this.items = [];
      }

      console.log(
        `Uploaded ${itemsToUpload.length} items of type ${this.itemType}. Number of items left in repo: ${this.items.length}.`
      );
    } else {
      console.log(
        `No items to upload for type ${this.itemType}. Skipping upload.`
      );
    }
  }

  /**
   * Normalizes and buffers items, uploading full batches as they accumulate.
   *
   * Used by connectors to feed extracted items into the repo; items are normalized (unless the item
   * type is external domain metadata or SSOR attachments) and any complete batches of batchSize are
   * uploaded immediately, leaving the remainder buffered for a later flush.
   *
   * @param items - Array of raw Item records to normalize and buffer.
   * @returns Promise that resolves to true when items were buffered/uploaded successfully, or false if a batch upload threw.
   */
  async push(items: Item[]): Promise<boolean> {
    let recordsToPush: (NormalizedItem | NormalizedAttachment | Item)[];

    if (!items || items.length === 0) {
      console.log(`No items to push for type ${this.itemType}. Skipping push.`);
      return true;
    }

    // Normalize items if needed
    if (
      this.normalize &&
      this.itemType != AirSyncDefaultItemTypes.EXTERNAL_DOMAIN_METADATA &&
      this.itemType != SSOR_ATTACHMENT
    ) {
      recordsToPush = runWithUserLogContext(() =>
        items.map((item: Item) => this.normalize!(item))
      );
    } else {
      recordsToPush = items;
    }

    // Add the new records to the items array
    this.items.push(...recordsToPush);

    // Upload in batches while the number of items exceeds the batch size
    const batchSize = this.options?.batchSize || ARTIFACT_BATCH_SIZE;
    while (this.items.length >= batchSize) {
      // Slice out a batch of batchSize items to upload
      const batch = this.items.splice(0, batchSize);

      try {
        // Upload the batch
        await this.upload(batch);
      } catch (error) {
        console.error('Error while uploading batch', error);
        return false;
      }
    }

    return true;
  }
}
