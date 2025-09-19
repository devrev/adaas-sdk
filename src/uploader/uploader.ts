import fs, { promises as fsPromises } from 'fs';
import zlib from 'zlib';

import { AxiosResponse } from 'axios';
import { jsonl } from 'js-jsonl';
import FormData from 'form-data';

import { axiosClient } from '../http/axios-client-internal';
import { MAX_DEVREV_ARTIFACT_SIZE } from '../common/constants';
import { truncateFilename } from '../common/helpers';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { serializeError } from '../logger/logger';

import {
  Artifact,
  UploadResponse,
  UploaderFactoryInterface,
  ArtifactToUpload,
} from './uploader.interfaces';

/**
 * Uploader class is used to upload files to the DevRev platform.
 * The class provides utilities to:
 * - upload artifacts to the platform
 * - get artifact upload URL
 * - upload artifact to the upload URL
 * - stream artifact to the upload URL
 * - confirm artifact upload
 * - get attachments from the artifact id
 * - get json object by artifact id
 * - download object or objects array to the local file system
 * - compress and decompress jsonl objects
 * - parse jsonl objects
 *
 * @class Uploader
 * @constructor
 * @param {UploaderFactoryInterface} factory - The factory interface to create a new instance of Uploader class
 * @param {AirdropEvent} event - The event object received from the platform
 * @param {WorkerAdapterOptions} options - The options to create a new instance of Uploader class
 */
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
   * Uploads the fetched objects to the artifact upload URL, confirms the upload and returns the artifact information.
   * @param {string} itemType - The type of the item to be uploaded
   * @param {object[] | object} fetchedObjects - The fetched objects to be uploaded
   * @returns {Promise<UploadResponse>} - The response object containing the artifact information or error information if there was an error
   */
  async upload(
    itemType: string,
    fetchedObjects: object[] | object
  ): Promise<UploadResponse> {
    if (this.isLocalDevelopment) {
      await this.downloadToLocal(itemType, fetchedObjects);
    }
    // Compress the fetched objects to a gzipped jsonl object
    const file = this.compressGzip(jsonl.stringify(fetchedObjects));
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
   * Gets the artifact upload URL.
   * @param {string} filename - The name of the file to be uploaded
   * @param {string} fileType - The type of the file to be uploaded
   * @returns {Promise<ArtifactToUpload | void>} - The artifact upload URL or null if there was an error
   */
  async getArtifactUploadUrl(
    filename: string,
    fileType: string
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
   * Uploads the artifact to the upload URL.
   * @param {ArtifactToUpload} artifact - The artifact to be uploaded
   * @param {Buffer} file - The file to be uploaded
   * @returns {Promise<AxiosResponse | void>} - The response or null if there was an error
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
   * Streams the artifact to the upload URL.
   * @param {ArtifactToUpload} artifact - The artifact to be streamed
   * @param {any} fileStream - The file stream to be streamed
   * @returns {Promise<AxiosResponse | void>} - The response or null if there was an error
   */
  async streamArtifact(
    artifact: ArtifactToUpload,
    fileStream: any
  ): Promise<AxiosResponse | void> {
    const formData = new FormData();
    for (const field in artifact.form_data) {
      formData.append(field, artifact.form_data[field]);
    }
    formData.append('file', fileStream.data);

    if (fileStream.headers['content-length'] > MAX_DEVREV_ARTIFACT_SIZE) {
      console.warn(
        `File size exceeds the maximum limit of ${MAX_DEVREV_ARTIFACT_SIZE} bytes.`
      );
      return;
    }

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
        maxRedirects: 0, // Prevents buffering
        validateStatus: () => true, // Prevents errors on redirects
      });
      return response;
    } catch (error) {
      console.error('Error while streaming artifact.', serializeError(error));
      return;
    }
  }

  /**
   * Confirms the artifact upload.
   * @param {string} artifactId - The id of the artifact
   * @returns {Promise<AxiosResponse | void>} - The response or null if there was an error
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
   * Gets the attachments from the artifact id.
   * @param {string} artifact - The id of the artifact
   * @returns {Promise<{attachments?: NormalizedAttachment[], error?: {message: string}}>} - The attachments or null if there was an error
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
    const jsonlObject = this.decompressGzip(gzippedJsonlObject);
    if (!jsonlObject) {
      return {
        error: new Error('Error while decompressing gzipped jsonl object.'),
      };
    }

    // Parse the jsonl object to get the attachment metadata
    const jsonObject = this.parseJsonl(jsonlObject) as NormalizedAttachment[];
    if (!jsonObject) {
      return {
        error: new Error('Error while parsing jsonl object.'),
      };
    }

    return { attachments: jsonObject };
  }

  /**
   * Gets the artifact download URL.
   * @param {string} artifactId - The id of the artifact
   * @returns {Promise<string | void>} - The artifact download URL or null if there was an error
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
   * Downloads the artifact from the URL.
   * @param {string} artifactUrl - The URL of the artifact to be downloaded
   * @returns {Promise<Buffer | void>} - The artifact or null if there was an error
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
   * Compresses the jsonl object to a gzipped jsonl object.
   * @param {string} jsonlObject - The jsonl object to be compressed
   * @returns {Buffer | void} - The gzipped jsonl object or null if there was an error
   */
  private compressGzip(jsonlObject: string): Buffer | void {
    try {
      return zlib.gzipSync(jsonlObject);
    } catch (error) {
      console.error('Error while compressing jsonl object.', error);
    }
  }

  /**
   * Decompresses the gzipped jsonl object to get the jsonl object.
   * @param {Buffer} gzippedJsonlObject - The gzipped jsonl object to be decompressed
   * @returns {string | void} - The jsonl object or null if there was an error
   */
  private decompressGzip(gzippedJsonlObject: Buffer): string | void {
    try {
      const jsonlObject = zlib.gunzipSync(gzippedJsonlObject);
      return jsonlObject.toString();
    } catch (error) {
      console.error('Error while decompressing gzipped jsonl object.', error);
    }
  }

  /**
   * Parses the jsonl object to get the json object.
   * @param {string} jsonlObject - The jsonl object to be parsed
   * @returns {object[] | null} - The json object or null if there was an error
   */
  private parseJsonl(jsonlObject: string): object[] | null {
    try {
      return jsonl.parse(jsonlObject);
    } catch (error) {
      console.error('Error while parsing jsonl object.', error);
    }
    return null;
  }

  /**
   * Gets the json object by artifact id.
   * @param {string} artifactId - The id of the artifact
   * @param {boolean} isGzipped - Whether the artifact is gzipped
   * @returns {Promise<object[] | object | void>} - The json object or null if there was an error
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
      const decompressedArtifact = this.decompressGzip(artifact);
      if (!decompressedArtifact) {
        return;
      }

      const jsonlObject = Buffer.from(decompressedArtifact).toString('utf-8');
      return jsonl.parse(jsonlObject);
    }

    const jsonlObject = Buffer.from(artifact).toString('utf-8');
    return jsonl.parse(jsonlObject);
  }

  /**
   * Downloads the object or objets array to the local file system.
   * @param {string} itemType - The type of the item to be downloaded
   * @param {object | object[]} fetchedObjects - The object or objects array to be downloaded
   */
  private async downloadToLocal(
    itemType: string,
    fetchedObjects: object | object[]
  ) {
    console.log(`Downloading ${itemType} to local file system.`);
    try {
      if (!fs.existsSync('extracted_files')) {
        fs.mkdirSync('extracted_files');
      }

      const timestamp = new Date().getTime();
      const filePath = `extracted_files/extractor_${itemType}_${timestamp}.${itemType === 'external_domain_metadata' ? 'json' : 'jsonl'}`;
      const fileHandle = await fsPromises.open(filePath, 'w');
      let objArray = [];
      if (!Array.isArray(fetchedObjects)) {
        objArray.push(fetchedObjects);
      } else {
        objArray = fetchedObjects;
      }
      for (const jsonObject of objArray) {
        const jsonLine = JSON.stringify(jsonObject) + '\n';
        await fileHandle.write(jsonLine);
      }
      await fileHandle.close();
      console.log('Data successfully written to', filePath);
    } catch (error) {
      console.error('Error writing data to file.', error);
      return Promise.reject(error);
    }
  }
}
