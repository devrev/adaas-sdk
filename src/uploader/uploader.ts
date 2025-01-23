import { AxiosResponse } from 'axios';
import fs, { promises as fsPromises } from 'fs';
import { axios, axiosClient } from '../http/axios-client';
import zlib from 'zlib';
import { jsonl } from 'js-jsonl';
import FormData from 'form-data';
import { betaSDK, client } from '@devrev/typescript-sdk';

import { MAX_DEVREV_ARTIFACT_SIZE } from '../common/constants';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { AirdropEvent } from '../types/extraction';

import {
  Artifact,
  UploadResponse,
  UploaderFactoryInterface,
} from './uploader.interfaces';
import { serializeAxiosError } from '../logger/logger';

export class Uploader {
  private event: AirdropEvent;
  private betaDevrevSdk: betaSDK.Api<unknown>;
  private isLocalDevelopment?: boolean;

  constructor({ event, options }: UploaderFactoryInterface) {
    this.event = event;
    this.betaDevrevSdk = client.setupBeta({
      endpoint: event.execution_metadata.devrev_endpoint,
      token: event.context.secrets.service_account_token,
    });
    this.isLocalDevelopment = options?.isLocalDevelopment;
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
      this.downloadToLocal(itemType, fetchedObjects);
    }

    // 1. Compress the fetched objects to a gzipped jsonl object
    const file = await this.compressGzip(jsonl.stringify(fetchedObjects));
    if (!file) {
      return {
        error: { message: 'Error while compressing jsonl object.' },
      };
    }
    const filename = itemType + '.jsonl.gz';
    const fileType = 'application/x-gzip';

    // 2. Prepare the artifact for uploading
    const preparedArtifact = await this.prepareArtifact(filename, fileType);
    if (!preparedArtifact) {
      return {
        error: { message: 'Error while preparing artifact.' },
      };
    }

    // 3. Upload the file to the prepared artifact
    const uploadedArtifact = await this.uploadToArtifact(
      preparedArtifact,
      file
    );
    if (!uploadedArtifact) {
      return {
        error: { message: 'Error while uploading artifact.' },
      };
    }

    // 4. Return the artifact information to the platform
    const artifact: Artifact = {
      id: preparedArtifact.id,
      item_type: itemType,
      item_count: Array.isArray(fetchedObjects) ? fetchedObjects.length : 1,
    };

    console.log('Successful upload of artifact: ', artifact);
    return { artifact };
  }

  public async prepareArtifact(
    filename: string,
    fileType: string
  ): Promise<betaSDK.ArtifactsPrepareResponse | void> {
    try {
      const response = await this.betaDevrevSdk.artifactsPrepare({
        file_name: filename,
        file_type: fileType,
      });

      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        console.error(
          'Error while preparing artifact.',
          serializeAxiosError(error)
        );
      } else {
        console.error('Error while preparing artifact.', error);
      }
    }
  }

  private async uploadToArtifact(
    preparedArtifact: betaSDK.ArtifactsPrepareResponse,
    file: Buffer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<AxiosResponse | void> {
    const formData = new FormData();
    for (const field of preparedArtifact.form_data) {
      formData.append(field.key, field.value);
    }
    formData.append('file', file);

    try {
      const response = await axiosClient.post(preparedArtifact.url, formData, {
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

  public async streamToArtifact(
    preparedArtifact: betaSDK.ArtifactsPrepareResponse,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fileStreamResponse: any
  ): Promise<AxiosResponse | void> {
    const formData = new FormData();
    for (const field of preparedArtifact.form_data) {
      formData.append(field.key, field.value);
    }

    formData.append('file', fileStreamResponse.data);

    try {
      const response = await axiosClient.post(preparedArtifact.url, formData, {
        headers: {
          ...formData.getHeaders(),
          ...(!fileStreamResponse.headers['content-length'] && {
            'Content-Length': MAX_DEVREV_ARTIFACT_SIZE,
          }),
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

  public async getAttachmentsFromArtifactId({
    artifact,
  }: {
    artifact: string;
  }): Promise<{
    attachments?: NormalizedAttachment[];
    error?: { message: string };
  }> {
    // 1. Get the URL of the attachments metadata artifact
    const artifactUrl = await this.getArtifactDownloadUrl(artifact);

    if (!artifactUrl) {
      return {
        error: { message: 'Error while getting artifact download URL.' },
      };
    }

    // 2. Download artifact from the URL
    const gzippedJsonlObject = await this.downloadArtifact(artifactUrl);
    if (!gzippedJsonlObject) {
      return {
        error: { message: 'Error while downloading gzipped jsonl object.' },
      };
    }

    // 3. Decompress the gzipped jsonl object
    const jsonlObject = await this.decompressGzip(gzippedJsonlObject);
    if (!jsonlObject) {
      return {
        error: { message: 'Error while decompressing gzipped jsonl object.' },
      };
    }

    // 4. Parse the jsonl object to get the attachment metadata
    const jsonObject = (await this.parseJsonl(
      jsonlObject
    )) as NormalizedAttachment[];
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
    try {
      const response = await this.betaDevrevSdk.artifactsLocate({
        id: artifactId,
      });

      return response.data.url;
    } catch (error) {
      console.error('Error while getting artifact download URL.', error);
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

  private async compressGzip(jsonlObject: string): Promise<Buffer | void> {
    try {
      return zlib.gzipSync(jsonlObject);
    } catch (error) {
      console.error('Error while compressing jsonl object.', error);
    }
  }

  private async decompressGzip(
    gzippedJsonlObject: Buffer
  ): Promise<string | void> {
    try {
      const jsonlObject = await zlib.gunzipSync(gzippedJsonlObject);
      return jsonlObject.toString();
    } catch (error) {
      console.error('Error while decompressing gzipped jsonl object.', error);
    }
  }

  private async parseJsonl(jsonlObject: string): Promise<object[] | void> {
    try {
      return jsonl.parse(jsonlObject);
    } catch (error) {
      console.error('Error while parsing jsonl object.', error);
    }
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
      const decompressedArtifact = await this.decompressGzip(artifact);
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
