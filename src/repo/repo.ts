import {
  ARTIFACT_BATCH_SIZE,
  AIRDROP_DEFAULT_ITEM_TYPES,
} from '../common/constants';
import { ErrorRecord } from '../types/common';
import { Item } from '../repo/repo.interfaces';
import { Uploader } from '../uploader/uploader';
import { Artifact } from '../uploader/uploader.interfaces';

import {
  RepoFactoryInterface,
  NormalizedItem,
  NormalizedAttachment,
} from './repo.interfaces';

export class Repo {
  readonly itemType: string;
  private items: (NormalizedItem | NormalizedAttachment | Item)[];
  private normalize?: (item: Item) => NormalizedItem | NormalizedAttachment;
  private uploader: Uploader;
  private onUpload: (artifact: Artifact) => void;

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
  }

  getItems(): (NormalizedItem | NormalizedAttachment | Item)[] {
    return this.items;
  }

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

  async push(items: Item[]): Promise<boolean | ErrorRecord> {
    let recordsToPush: (NormalizedItem | NormalizedAttachment | Item)[];

    if (!items || items.length === 0) {
      console.log(`No items to push for type ${this.itemType}. Skipping push.`);
      return true;
    }

    // Normalize items if needed
    if (
      this.normalize &&
      this.itemType != AIRDROP_DEFAULT_ITEM_TYPES.EXTERNAL_DOMAIN_METADATA &&
      this.itemType != AIRDROP_DEFAULT_ITEM_TYPES.SSOR_ATTACHMENT
    ) {
      recordsToPush = items.map((item: Item) => this.normalize!(item));
    } else {
      recordsToPush = items;
    }

    // Add the new records to the items array
    this.items.push(...recordsToPush);

    // Upload in batches while the number of items exceeds the batch size
    while (this.items.length >= ARTIFACT_BATCH_SIZE) {
      // Slice out a batch of ARTIFACT_BATCH_SIZE items to upload
      const batch = this.items.splice(0, ARTIFACT_BATCH_SIZE);

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
