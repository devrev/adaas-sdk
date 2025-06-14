import fs, { promises as fsPromises } from 'fs';
import { axios, axiosClient } from '../http/axios-client';
import zlib from 'zlib';
import { jsonl } from 'js-jsonl';
import FormData from 'form-data';

import { MAX_DEVREV_ARTIFACT_SIZE } from '../common/constants';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { AirdropEvent } from '../types/extraction';

import {
  Artifact,
  UploadResponse,
  UploaderFactoryInterface,
  ArtifactToUpload,
} from './uploader.interfaces';
import { serializeAxiosError } from '../logger/logger';
import { AxiosResponse } from 'axios';

export class Uploader {
  private event: AirdropEvent;
  private isLocalDevelopment?: boolean;
  private devrevApiEndpoint: string;
  private devrevApiToken: string;
  private requestId: string;
  private defaultHeaders: Record<string, string>;

  constructor({ event, options }: UploaderFactoryInterface) {
    this.event = event;
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
    this.requestId = event.payload.event_context.request_id;
    this.isLocalDevelopment = options?.isLocalDevelopment;
    this.defaultHeaders = {
      Authorization: `Bearer ${this.devrevApiToken}`,
    };
  }

  /**
   * Uploads the fetched objects to the DevRev platform.
   * The fetched objects are uploaded to the platform and the artifact information is returned.
   * @param {string} filename - The name of the file to be uploaded
   * @param {string} itemType - The type of the item to be uploaded
   * @param {object[] | object} fetchedObjects - The fetched objects to be uploaded
   * @returns {Promise<UploadResponse>} - The response object containing the artifact information
   * or error information if there was an error
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
        error: { message: 'Error while compressing jsonl object.' },
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
        error: { message: 'Error while getting artifact upload URL.' },
      };
    }

    // Upload prepared artifact to the given url
    const uploadItemResponse = await this.uploadArtifact(
      preparedArtifact,
      file
    );
    if (!uploadItemResponse) {
      return {
        error: { message: 'Error while uploading artifact.' },
      };
    }

    // Confirm upload
    const confirmArtifactUploadResponse = await this.confirmArtifactUpload(
      preparedArtifact.artifact_id
    );
    if (!confirmArtifactUploadResponse) {
      return {
        error: { message: 'Error while confirming artifact upload.' },
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
          file_name: filename,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while getting artifact upload URL.',
          serializeAxiosError(error)
        );
      } else {
        console.error('Error while getting artifact upload URL.', error);
      }
    }
  }

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
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while uploading artifact.',
          serializeAxiosError(error)
        );
      } else {
        console.error('Error while uploading artifact.', error);
      }
    }
  }

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
      });
      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while streaming artifact.',
          serializeAxiosError(error)
        );
      } else {
        console.error('Error while streaming artifact.', error);
      }
      return;
    }
  }

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
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while confirming artifact upload.',
          serializeAxiosError(error)
        );
      } else {
        console.error('Error while confirming artifact upload.', error);
      }
    }
  }

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
        error: { message: 'Error while getting artifact download URL.' },
      };
    }

    // Download artifact from the URL
    const gzippedJsonlObject = await this.downloadArtifact(artifactUrl);
    if (!gzippedJsonlObject) {
      return {
        error: { message: 'Error while downloading gzipped jsonl object.' },
      };
    }

    // Decompress the gzipped jsonl object
    const jsonlObject = this.decompressGzip(gzippedJsonlObject);
    if (!jsonlObject) {
      return {
        error: { message: 'Error while decompressing gzipped jsonl object.' },
      };
    }

    // Parse the jsonl object to get the attachment metadata
    const jsonObject = this.parseJsonl(jsonlObject) as NormalizedAttachment[];
    if (!jsonObject) {
      return {
        error: { message: 'Error while parsing jsonl object.' },
      };
    }

    return { attachments: jsonObject };
  }

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
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while getting artifact download URL.',
          serializeAxiosError(error)
        );
      } else {
        console.error('Error while getting artifact download URL.', error);
      }
    }
  }

  private async downloadArtifact(artifactUrl: string): Promise<Buffer | void> {
    try {
      const response = await axiosClient.get(artifactUrl, {
        responseType: 'arraybuffer',
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while downloading artifact from URL.',
          serializeAxiosError(error)
        );
      } else {
        console.error('Error while downloading artifact from URL.', error);
      }
    }
  }

  private compressGzip(jsonlObject: string): Buffer | void {
    try {
      return zlib.gzipSync(jsonlObject);
    } catch (error) {
      console.error('Error while compressing jsonl object.', error);
    }
  }

  private decompressGzip(gzippedJsonlObject: Buffer): string | void {
    try {
      const jsonlObject = zlib.gunzipSync(gzippedJsonlObject);
      return jsonlObject.toString();
    } catch (error) {
      console.error('Error while decompressing gzipped jsonl object.', error);
    }
  }

  private parseJsonl(jsonlObject: string): object[] | null {
    try {
      return jsonl.parse(jsonlObject);
    } catch (error) {
      console.error('Error while parsing jsonl object.', error);
    }
    return null;
  }

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
