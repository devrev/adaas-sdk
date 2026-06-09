import { Artifact } from '../uploader/uploader.interfaces';

import { AirSyncEvent } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';

/**
 * Describes a repo configuration that stores and uploads extracted data of one item type.
 *
 * Used to declare which item type a repo holds and how its raw records should be normalized.
 */
export interface RepoInterface {
  /** The item type the repo buffers and uploads. */
  itemType: string;
  /** Optional normalizer turning a raw record into a NormalizedItem or NormalizedAttachment. */
  normalize?: (record: object) => NormalizedItem | NormalizedAttachment;
  /** Optional worker adapter options that override defaults (e.g. batch size). */
  overridenOptions?: WorkerAdapterOptions;
}

/**
 * Construction parameters used to create a Repo instance.
 *
 * Used to wire a repo to its triggering event, item type, normalizer, upload callback, and options.
 */
export interface RepoFactoryInterface {
  /** The AirSync event that drives the extraction and supplies platform credentials. */
  event: AirSyncEvent;
  /** The item type the repo buffers and uploads. */
  itemType: string;
  /** Optional normalizer turning a raw record into a NormalizedItem or NormalizedAttachment. */
  normalize?: (record: object) => NormalizedItem | NormalizedAttachment;
  /** Callback invoked with each Artifact once it has been uploaded. */
  onUpload: (artifact: Artifact) => void;
  /** Optional worker adapter options that override defaults (e.g. batch size). */
  options?: WorkerAdapterOptions;
}

/**
 * An external system item after normalization into the shape AirSync expects.
 *
 * Used as the uploaded representation of a non-attachment record.
 */
export interface NormalizedItem {
  /** External system identifier of the item. */
  id: string;
  /** ISO timestamp of when the item was created in the external system. */
  created_date: string;
  /** ISO timestamp of when the item was last modified in the external system. */
  modified_date: string;
  /** Normalized field values of the item. */
  data: object;
}

/**
 * An external system attachment after normalization into the shape AirSync expects.
 *
 * Used as the uploaded metadata for an attachment whose binary is streamed separately.
 */
export interface NormalizedAttachment {
  /** Source URL the attachment binary can be downloaded from. */
  url: string;
  /** External system identifier of the attachment. */
  id: string;
  /** Name of the attached file. */
  file_name: string;
  /** External system identifier of the item the attachment belongs to. */
  parent_id: string;
  /** Optional external system identifier of the attachment's author. */
  author_id?: string;
  /** Whether the attachment is embedded inline (e.g. in rich text) rather than a standalone file. */
  inline?: boolean;
  /** Optional MIME type of the attachment. */
  content_type?: string;

  // This should be a string, but it was a number in the past. Due to backwards
  // compatibility we are keeping it also as a number.
  /** Optional external identifier of the parent's parent; kept as number for backwards compatibility. */
  grand_parent_id?: number | string;
}

/**
 * A raw, un-normalized record extracted from the external system.
 *
 * Used as the input to a repo's normalize function before items are uploaded.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Item = Record<string, any>;
