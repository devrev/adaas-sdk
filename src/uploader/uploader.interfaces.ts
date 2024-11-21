import { AirdropEvent } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';
import { ErrorRecord } from '../types/common';

export interface UploaderFactoryInterface {
  event: AirdropEvent;
  options?: WorkerAdapterOptions;
}

/**
 * Artifact is an interface that defines the structure of an artifact. Artifact is a file that is generated by the extractor and uploaded to ADaaS.
 */
export interface Artifact {
  id: string;
  item_type: string;
  item_count: number;
}

/**
 * ArtifactsPrepareResponse is an interface that defines the structure of the response from the prepare artifacts endpoint.
 * @deprecated
 */
export interface ArtifactsPrepareResponse {
  url: string;
  id: string;
  form_data: {
    key: string;
    value: string;
  }[];
}

/**
 * UploadResponse is an interface that defines the structure of the response from upload through Uploader.
 */
export interface UploadResponse {
  artifact?: Artifact;
  error?: ErrorRecord;
}

/**
 * StreamAttachmentsResponse is an interface that defines the structure of the response from the stream attachments through Uploader.
 */
export interface StreamAttachmentsResponse {
  ssorAttachments?: SsorAttachment[];
  error?: ErrorRecord;
}

/**
 * StreamResponse is an interface that defines the structure of the response from the stream of single attachment through Uploader.
 */
export interface StreamResponse {
  ssorAttachment?: SsorAttachment;
  error?: ErrorRecord;
}

/**
 * SsorAttachment is an interface that defines the structure of the SSOR attachment.
 */
export interface SsorAttachment {
  id: {
    devrev: string;
    external: string;
  };
  parent_id: {
    external: string;
  };
  actor_id: {
    external: string;
  };
}