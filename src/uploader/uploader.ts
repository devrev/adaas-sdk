import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { jsonl } from 'js-jsonl';
import { axiosClient } from '../http/axios-client-internal';

import { MAX_DEVREV_ARTIFACT_SIZE } from '../common/constants';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { serializeError } from '../logger/logger';

import {
  compressGzip,
  decompressGzip,
  downloadToLocal,
  parseJsonl,
  truncateFilename,
} from './uploader.helpers';
import {
  Artifact,
  ArtifactToUpload,
  UploadResponse,
  UploaderFactoryInterface,
} from './uploader.interfaces';

export class Uploader {
  private isLocalDevelopment?: boolean;
  private devrevApiEndpoint: string;
  private devrevApiToken: string;
  private requestId: string;
  private defaultHeaders: Record<string, string>;

  constructor({ event, options }: UploaderFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
    this.requestId = event.payload.event_context.request_id;
    this.isLocalDevelopment = options?.isLocalDevelopment;
    this.defaultHeaders = {
      Authorization: `Bearer ${this.devrevApiToken}`,
    };
  }

  /**
   * Uploads the fetched objects to the DevRev platform. Fetched objects are compressed to a gzipped jsonl object and uploaded to the platform.
   * @param {string} itemType - The type of the item to be uploaded
   * @param {object[] | object} fetchedObjects - The objects to be uploaded
   * @returns {Promise<UploadResponse>} - The response object containing the artifact information or error information if there was an error
   */
  async upload(
    itemType: string,
    fetchedObjects: object[] | object
  ): Promise<UploadResponse> {
    if (this.isLocalDevelopment) {
      await downloadToLocal(itemType, fetchedObjects);
    }
    // Compress the fetched objects to a gzipped jsonl object
    const file = compressGzip(jsonl.stringify(fetchedObjects));
    if (!file) {
      return {
        error: new Error('Error while compressing jsonl object.'),
      };
    }
    const filename = itemType + '.jsonl.gz';
    const fileType = 'application/x-gzip';

    // Get upload url
    const preparedArtifact = await this.getArtifactUploadUrl(
      filename,
      fileType
    );
    if (!preparedArtifact) {
      return {
        error: new Error('Error while getting artifact upload URL.'),
      };
    }

    // Upload prepared artifact to the given url
    const uploadItemResponse = await this.uploadArtifact(
      preparedArtifact,
      file
    );
    if (!uploadItemResponse) {
      return {
        error: new Error('Error while uploading artifact.'),
      };
    }

    // Confirm upload
    const confirmArtifactUploadResponse = await this.confirmArtifactUpload(
      preparedArtifact.artifact_id
    );
    if (!confirmArtifactUploadResponse) {
      return {
        error: new Error('Error while confirming artifact upload.'),
      };
    }

    // Return the artifact information to the platform
    const artifact: Artifact = {
      id: preparedArtifact.artifact_id,
      item_type: itemType,
      item_count: Array.isArray(fetchedObjects) ? fetchedObjects.length : 1,
    };

    return { artifact };
  }

  /**
   * Gets the upload URL for an artifact from the DevRev API.
   * @param {string} filename - The name of the file to upload
   * @param {string} fileType - The MIME type of the file
   * @param {number} [fileSize] - Optional file size in bytes
   * @returns {Promise<ArtifactToUpload | void>} The artifact upload information or undefined on error
   */
  async getArtifactUploadUrl(
    filename: string,
    fileType: string,
    fileSize?: number
  ): Promise<ArtifactToUpload | void> {
    const url = `${this.devrevApiEndpoint}/internal/airdrop.artifacts.upload-url`;

    try {
      const response = await axiosClient.get(url, {
        headers: {
          ...this.defaultHeaders,
        },
        params: {
          request_id: this.requestId,
          file_type: fileType,
          file_name: truncateFilename(filename),
          file_size: fileSize,
        },
      });
      return response.data;
    } catch (error) {
      console.error(
        'Error while getting artifact upload URL.',
        serializeError(error)
      );
    }
  }

  /**
   * Uploads an artifact file to the provided upload URL using multipart form data.
   * @param {ArtifactToUpload} artifact - The artifact upload information containing upload URL and form data
   * @param {Buffer} file - The file buffer to upload
   * @returns {Promise<AxiosResponse | void>} The axios response or undefined on error
   */
  async uploadArtifact(
    artifact: ArtifactToUpload,
    file: Buffer
  ): Promise<AxiosResponse | void> {
    const formData = new FormData();
    for (const field in artifact.form_data) {
      formData.append(field, artifact.form_data[field]);
    }
    formData.append('file', file);

    try {
      const response = await axiosClient.post(artifact.upload_url, formData, {
        headers: {
          ...formData.getHeaders(),
        },
      });
      return response;
    } catch (error) {
      console.error('Error while uploading artifact.', serializeError(error));
    }
  }

  /**
   * Streams an artifact file from an axios response to the upload URL.
   * @param {ArtifactToUpload} artifact - The artifact upload information containing upload URL and form data
   * @param {AxiosResponse} fileStream - The axios response stream containing the file data
   * @returns {Promise<AxiosResponse | void>} The axios response or undefined on error
   */
  async streamArtifact(
    artifact: ArtifactToUpload,
    fileStream: AxiosResponse
  ): Promise<AxiosResponse | void> {
    const formData = new FormData();
    for (const field in artifact.form_data) {
      formData.append(field, artifact.form_data[field]);
    }
    formData.append('file', fileStream.data);

    try {
      const response = await axiosClient.post(artifact.upload_url, formData, {
        headers: {
          ...formData.getHeaders(),
          ...(!fileStream.headers['content-length']
            ? {
                'Content-Length': MAX_DEVREV_ARTIFACT_SIZE,
              }
            : {}),
        },
        // Prevents buffering of the response in the memory
        maxRedirects: 0,
        // Allow 2xx and 3xx (redirects) to be considered successful, 4xx and 5xx will throw errors and be caught in the catch block
        validateStatus: (status) => status >= 200 && status < 400,
      });
      this.destroyStream(fileStream);
      return response;
    } catch (error) {
      console.error('Error while streaming artifact.', serializeError(error));
      this.destroyStream(fileStream);
      return;
    }
  }

  /**
   * Confirms that an artifact upload has been completed successfully.
   * @param {string} artifactId - The ID of the artifact to confirm
   * @returns {Promise<AxiosResponse | void>} The axios response or undefined on error
   */
  async confirmArtifactUpload(
    artifactId: string
  ): Promise<AxiosResponse | void> {
    const url = `${this.devrevApiEndpoint}/internal/airdrop.artifacts.confirm-upload`;
    try {
      const response = await axiosClient.post(
        url,
        {
          request_id: this.requestId,
          artifact_id: artifactId,
        },
        {
          headers: {
            ...this.defaultHeaders,
          },
        }
      );
      return response;
    } catch (error) {
      console.error(
        'Error while confirming artifact upload.',
        serializeError(error)
      );
    }
  }

  /**
   * Destroys a stream to prevent resource leaks.
   * @param {any} fileStream - The axios response stream to destroy
   */
  private destroyStream(fileStream: AxiosResponse): void {
    try {
      if (fileStream && fileStream.data) {
        // For axios response streams, the data property contains the actual stream
        if (typeof fileStream.data.destroy === 'function') {
          fileStream.data.destroy();
        } else if (typeof fileStream.data.close === 'function') {
          fileStream.data.close();
        }
      }
    } catch (error) {
      console.warn('Error while destroying stream:', serializeError(error));
    }
  }

  /**
   * Retrieves attachment metadata from an artifact by downloading and parsing it.
   * @param {object} param0 - Configuration object
   * @param {string} param0.artifact - The artifact ID to download attachments from
   * @returns {Promise<{attachments?: NormalizedAttachment[], error?: {message: string}}>} The attachments array or error object
   */
  async getAttachmentsFromArtifactId({
    artifact,
  }: {
    artifact: string;
  }): Promise<{
    attachments?: NormalizedAttachment[];
    error?: { message: string };
  }> {
    // Get the URL of the attachments metadata artifact
    const artifactUrl = await this.getArtifactDownloadUrl(artifact);

    if (!artifactUrl) {
      return {
        error: new Error('Error while getting artifact download URL.'),
      };
    }

    // Download artifact from the URL
    const gzippedJsonlObject = await this.downloadArtifact(artifactUrl);
    if (!gzippedJsonlObject) {
      return {
        error: new Error('Error while downloading gzipped jsonl object.'),
      };
    }

    // Decompress the gzipped jsonl object
    const jsonlObject = decompressGzip(gzippedJsonlObject);
    if (!jsonlObject) {
      return {
        error: new Error('Error while decompressing gzipped jsonl object.'),
      };
    }

    // Parse the jsonl object to get the attachment metadata
    const jsonObject = parseJsonl(jsonlObject) as NormalizedAttachment[];
    if (!jsonObject) {
      return {
        error: new Error('Error while parsing jsonl object.'),
      };
    }

    return { attachments: jsonObject };
  }

  /**
   * Gets the download URL for an artifact from the DevRev API.
   * @param {string} artifactId - The ID of the artifact to download
   * @returns {Promise<string | void>} The download URL or undefined on error
   */
  private async getArtifactDownloadUrl(
    artifactId: string
  ): Promise<string | void> {
    const url = `${this.devrevApiEndpoint}/internal/airdrop.artifacts.download-url`;

    try {
      const response = await axiosClient.get(url, {
        headers: {
          ...this.defaultHeaders,
        },
        params: {
          request_id: this.requestId,
          artifact_id: artifactId,
        },
      });

      return response.data.download_url;
    } catch (error) {
      console.error(
        'Error while getting artifact download URL.',
        serializeError(error)
      );
    }
  }

  /**
   * Downloads an artifact file from the given URL.
   * @param {string} artifactUrl - The URL to download the artifact from
   * @returns {Promise<Buffer | void>} The artifact file buffer or undefined on error
   */
  private async downloadArtifact(artifactUrl: string): Promise<Buffer | void> {
    try {
      const response = await axiosClient.get(artifactUrl, {
        responseType: 'arraybuffer',
      });

      return response.data;
    } catch (error) {
      console.error(
        'Error while downloading artifact from URL.',
        serializeError(error)
      );
    }
  }

  /**
   * Retrieves and parses JSON objects from an artifact by artifact ID.
   * @param {object} param0 - Configuration object
   * @param {string} param0.artifactId - The artifact ID to download and parse
   * @param {boolean} [param0.isGzipped=false] - Whether the artifact is gzipped
   * @returns {Promise<object[] | object | void>} The parsed JSON objects or undefined on error
   */
  async getJsonObjectByArtifactId({
    artifactId,
    isGzipped = false,
  }: {
    artifactId: string;
    isGzipped?: boolean;
  }): Promise<object[] | object | void> {
    const artifactUrl = await this.getArtifactDownloadUrl(artifactId);
    if (!artifactUrl) {
      return;
    }

    const artifact = await this.downloadArtifact(artifactUrl);
    if (!artifact) {
      return;
    }

    if (isGzipped) {
      const decompressedArtifact = decompressGzip(artifact);
      if (!decompressedArtifact) {
        return;
      }

      const jsonlObject = Buffer.from(decompressedArtifact).toString('utf-8');
      return jsonl.parse(jsonlObject);
    }

    const jsonlObject = Buffer.from(artifact).toString('utf-8');
    return jsonl.parse(jsonlObject);
  }
}
