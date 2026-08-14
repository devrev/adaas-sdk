import {
  AirSyncDefaultItemTypes,
  ARTIFACT_BATCH_SIZE,
  SSOR_ATTACHMENT,
} from '../common/constants';
import { Item } from '../repo/repo.interfaces';
import { ErrorRecord } from '../types/common';
import { WorkerAdapterOptions } from '../types/workers';
import { Uploader } from '../uploader/uploader';
import { Artifact } from '../uploader/uploader.interfaces';

import { toValidTimestamp, updateRange } from './repo.helpers';
import {
  NormalizedAttachment,
  NormalizedItem,
  RepoFactoryInterface,
} from './repo.interfaces';

export class Repo {
  readonly itemType: string;
  private items: (NormalizedItem | NormalizedAttachment | Item)[];
  private normalize?: (item: Item) => NormalizedItem | NormalizedAttachment;
  private uploader: Uploader;
  private onUpload: (artifact: Artifact) => void;
  private options?: WorkerAdapterOptions;
  public uploadedArtifacts: Artifact[];
  public dateRanges: {
    creationDate: { oldest?: number; newest?: number };
    modifiedDate: { oldest?: number; newest?: number };
  } = {
    creationDate: {},
    modifiedDate: {},
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
  ): Promise<void | ErrorRecord> {
    const itemsToUpload = batch || this.items;

    if (itemsToUpload.length > 0) {
      for (const item of itemsToUpload) {
        const createdDate = (item as NormalizedItem)?.created_date;
        if (createdDate != null) {
          const createdMs = toValidTimestamp(createdDate);
          if (createdMs !== undefined) {
            updateRange(this.dateRanges.creationDate, createdMs);
          }
        }
        const modifiedDate = (item as NormalizedItem)?.modified_date;
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
        return error;
      }

      this.onUpload(artifact);

      this.uploadedArtifacts.push(artifact);

      // An explicit batch was already spliced out of this.items by the caller
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

    if (
      this.normalize &&
      this.itemType != AirSyncDefaultItemTypes.EXTERNAL_DOMAIN_METADATA &&
      this.itemType != SSOR_ATTACHMENT
    ) {
      recordsToPush = items.map((item: Item) => this.normalize!(item));
    } else {
      recordsToPush = items;
    }

    this.items.push(...recordsToPush);

    const batchSize = this.options?.batchSize || ARTIFACT_BATCH_SIZE;
    while (this.items.length >= batchSize) {
      const batch = this.items.splice(0, batchSize);

      try {
        await this.upload(batch);
      } catch (error) {
        console.error('Error while uploading batch', error);
        return false;
      }
    }

    return true;
  }
}
