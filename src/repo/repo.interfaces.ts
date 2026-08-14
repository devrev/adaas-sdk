import { AirSyncEvent } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';
import { Artifact } from '../uploader/uploader.interfaces';

/** Stores and uploads extracted data. */
export interface RepoInterface {
  itemType: string;
  normalize?: (record: object) => NormalizedItem | NormalizedAttachment;
  overridenOptions?: WorkerAdapterOptions;
}

export interface RepoFactoryInterface {
  event: AirSyncEvent;
  itemType: string;
  normalize?: (record: object) => NormalizedItem | NormalizedAttachment;
  onUpload: (artifact: Artifact) => void;
  options?: WorkerAdapterOptions;
}

export interface NormalizedItem {
  id: string;
  created_date: string;
  modified_date: string;
  data: object;
}

export interface NormalizedAttachment {
  url: string;
  id: string;
  file_name: string;
  parent_id: string;
  author_id?: string;
  inline?: boolean;
  content_type?: string;
  created_date?: string;
  modified_date?: string;

  // number kept only for backwards compatibility; should be a string
  grand_parent_id?: number | string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Item = Record<string, any>;
