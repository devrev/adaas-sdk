import {
  AirSyncDefaultItemTypes,
  ARTIFACT_BATCH_SIZE,
  SSOR_ATTACHMENT,
} from '../common/constants';
import { isFieldLevelMergeEnabled } from '../common/feature-flags';
import { Item } from '../repo/repo.interfaces';
import { RecordManager } from '../record-manager/record-manager';
import { AirdropEvent } from '../types/extraction';
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
import { updateRange, toValidTimestamp } from './repo.helpers';

export class Repo {
  readonly itemType: string;
  private items: (NormalizedItem | NormalizedAttachment | Item)[];
  private normalize?: (item: Item) => NormalizedItem | NormalizedAttachment;
  private uploader: Uploader;
  private onUpload: (artifact: Artifact) => void;
  private options?: WorkerAdapterOptions;
  private event: AirdropEvent;
  private recordManager?: RecordManager;
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
    recordManager,
  }: RepoFactoryInterface) {
    this.items = [];
    this.itemType = itemType;
    this.normalize = normalize;
    this.onUpload = onUpload;
    this.uploader = new Uploader({ event, options });
    this.options = options;
    this.event = event;
    this.uploadedArtifacts = [];
    this.recordManager = recordManager;
  }

  getItems(): (NormalizedItem | NormalizedAttachment | Item)[] {
    return this.items;
  }

  /**
   * ENH-7536 (External-Extractor / E2DR, proposal §5.3): replaces each
   * normalized item's data with the field-level delta the record-manager
   * computes against RecordExternalExtractorSeen and
   * RecordExternalLoaderAttempted, so the transformer receives only changed
   * fields instead of the whole object. Calls the
   * `ExtractorRecordMergingSet` snapin-manager proxy
   * (devrev/airdrop-snapin-manager PR #434, ASFND-298), which forwards to
   * the (now real, Mongo-backed) RecordExternalExtractorSeenSet.
   *
   * Items with no id are skipped rather than sent: `external_object_identifier`
   * is a required field on the proxy request and `external_record_id` must
   * have at least one character.
   *
   * PLATFORM CHECK REQUIRED before this is relied on in production: the
   * proxy RPC is RPC_TYPE_INTERNAL and not yet bound into the gateway's REST
   * layer (devrev/gateway apiv2/airdrop_snapin_manager.proto has no
   * record-merging entries) - the endpoint path in RecordManager is a
   * placeholder (see RECORD_MANAGER_ENDPOINTS). Per-item network round trips
   * here (one extractorRecordMergingSet call per item) proceed as-is for the
   * Salesforce/EROAD pilot per plan decision; revisit batch support with
   * platform if throughput becomes an issue.
   */
  private async applyFieldLevelMerge(
    items: NormalizedItem[]
  ): Promise<NormalizedItem[]> {
    if (!this.recordManager) {
      return items;
    }

    return Promise.all(
      items.map(async (item) => {
        if (!item.id) {
          return item;
        }

        try {
          const { data } = await this.recordManager!.extractorRecordMergingSet({
            external_object_identifier: { external_record_id: item.id },
            external_object: item.data as Record<string, unknown>,
          });

          return { ...item, data: data.external_object_diff };
        } catch (error) {
          console.warn(
            `Failed to apply field-level merge for item ${item.id} of type ${this.itemType}, falling back to whole object.`,
            error
          );
          return item;
        }
      })
    );
  }

  async upload(
    batch?: (NormalizedItem | NormalizedAttachment | Item)[]
  ): Promise<void | ErrorRecord> {
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
      const normalizedItems = runWithUserLogContext(() =>
        items.map((item: Item) => this.normalize!(item))
      );

      // ENH-7536 (External-Extractor / E2DR field-level merge, proposal §5.3).
      // Attachments have no `.data` field to diff, so they're excluded here.
      // See applyFieldLevelMerge for platform caveats.
      recordsToPush =
        isFieldLevelMergeEnabled(this.event) &&
        this.recordManager &&
        this.itemType != AirSyncDefaultItemTypes.ATTACHMENTS
          ? await this.applyFieldLevelMerge(normalizedItems as NormalizedItem[])
          : normalizedItems;
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
