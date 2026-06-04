import {
  AirSyncDefaultItemTypes,
  ARTIFACT_BATCH_SIZE,
  SSOR_ATTACHMENT,
} from '../common/constants';
import { Item } from '../repo/repo.interfaces';
import { Uploader } from '../uploader/uploader';
import { Artifact } from '../uploader/uploader.interfaces';

import { WorkerAdapterOptions } from '../types/workers';
import { runWithUserLogContext } from '../logger/logger.context';
import {
  NormalizedAttachment,
  NormalizedItem,
  RepoFactoryInterface,
} from './repo.interfaces';

function updateRange(
  range: { oldest: number; newest: number },
  ms: number
): void {
  if (range.oldest === 0 || ms < range.oldest) {
    range.oldest = ms;
  }
  if (range.newest === 0 || ms > range.newest) {
    range.newest = ms;
  }
}

function toValidTimestamp(value: string): number | undefined {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

export class Repo {
  readonly itemType: string;
  private items: (NormalizedItem | NormalizedAttachment | Item)[];
  private normalize?: (item: Item) => NormalizedItem | NormalizedAttachment;
  private uploader: Uploader;
  private onUpload: (artifact: Artifact) => void;
  private options?: WorkerAdapterOptions;
  public uploadedArtifacts: Artifact[];
  public dateRanges = {
    creationDate: { oldest: 0, newest: 0 },
    modifiedDate: { oldest: 0, newest: 0 },
  };

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

  getItems(): (NormalizedItem | NormalizedAttachment | Item)[] {
    return this.items;
  }

  async upload(
    batch?: (NormalizedItem | NormalizedAttachment | Item)[]
  ): Promise<void> {
    const itemsToUpload = batch || this.items;

    if (itemsToUpload.length > 0) {
      for (const item of itemsToUpload) {
        const createdDate = item?.created_date;
        if (createdDate != null) {
          const createdMs = toValidTimestamp(createdDate);
          if (createdMs !== undefined) {
            updateRange(this.dateRanges.creationDate, createdMs);
          }
        }
        const modifiedDate = item?.modified_date;
        if (modifiedDate != null && modifiedDate !== '') {
          const modifiedMs = toValidTimestamp(modifiedDate);
          if (modifiedMs !== undefined) {
            updateRange(this.dateRanges.modifiedDate, modifiedMs);
          }
        }
      }

      console.log(
        `Uploading ${itemsToUpload.length} items of type ${this.itemType}. `
      );

      const { artifact, error } = await this.uploader.upload(
        this.itemType,
        itemsToUpload
      );

      if (error || !artifact) {
        console.error('Error while uploading batch', error);
        throw new Error(
          error?.message ??
            `Upload failed for item type "${this.itemType}" without artifact.`
        );
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
      const batch = this.items.slice(0, batchSize);
      await this.upload(batch);
      this.items.splice(0, batchSize);
    }

    return true;
  }
}
