import { axiosClient } from '../../http/axios-client';
import { betaSDK, client } from '@devrev/typescript-sdk';
import fs, { promises as fsPromises } from 'fs';
import { createFormData } from '../common/helpers';
import { Artifact, UploadResponse } from '../../uploader/uploader.interfaces';

/**
 * Uploader class is used to upload files to the DevRev platform.
 * The class provides utilities to
 * - prepare artifact
 * - upload artifact
 * - return the artifact information to the platform
 *
 * @class Uploader
 * @constructor
 * @param {string} endpoint - The endpoint of the DevRev platform
 * @param {string} token - The token to authenticate with the DevRev platform
 * @param {boolean} local - Flag to indicate if the uploader should upload to the file-system.
 */
export class Uploader {
  private betaDevrevSdk: betaSDK.Api<unknown>;
  private local: boolean;
  constructor(endpoint: string, token: string, local = false) {
    this.betaDevrevSdk = client.setupBeta({
      endpoint,
      token,
    });
    this.local = local;
  }

  /**
   *
   *  Uploads the file to the DevRev platform. The file is uploaded to the platform
   *  and the artifact information is returned.
   *
   * @param {string} filename - The name of the file to be uploaded
   * @param {string} entity - The entity type of the file to be uploaded
   * @param {object[] | object} fetchedObjects - The objects to be uploaded
   * @param filetype - The type of the file to be uploaded
   * @returns {Promise<UploadResponse>} - The response object containing the artifact information
   */
  async upload(
    filename: string,
    entity: string,
    fetchedObjects: object[] | object,
    filetype: string = 'application/jsonl+json'
  ): Promise<UploadResponse> {
    if (this.local) {
      await this.downloadToLocal(filename, fetchedObjects);
    }

    const preparedArtifact = await this.prepareArtifact(filename, filetype);

    if (!preparedArtifact) {
      return {
        artifact: undefined,
        error: { message: 'Error while preparing artifact' },
      };
    }

    const uploadedArtifact = await this.uploadToArtifact(
      preparedArtifact,
      fetchedObjects
    );

    if (!uploadedArtifact) {
      return {
        artifact: undefined,
        error: { message: 'Error while uploading artifact' },
      };
    }

    // If file was successfully uploaded we want to post data about that file when emitting
    const itemCount = Array.isArray(fetchedObjects) ? fetchedObjects.length : 1;
    const artifact: Artifact = {
      id: preparedArtifact.id,
      item_type: entity,
      item_count: itemCount,
    };

    console.log(`Artifact uploaded successfully: ${artifact.id}`);

    return { artifact, error: undefined };
  }

  private async prepareArtifact(
    filename: string,
    filetype: string
  ): Promise<betaSDK.ArtifactsPrepareResponse | null> {
    try {
      const response = await this.betaDevrevSdk.artifactsPrepare({
        file_name: filename,
        file_type: filetype,
      });

      return response.data;
    } catch (error) {
      console.error('Error while preparing artifact: ' + error);
      return null;
    }
  }

  private async uploadToArtifact(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preparedArtifact: any,
    fetchedObjects: object[] | object
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ): Promise<any | null> {
    const formData = createFormData(preparedArtifact, fetchedObjects);
    try {
      const response = await axiosClient.post(preparedArtifact.url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      return response;
    } catch (error) {
      console.error('Error while uploading artifact: ' + error);
      return null;
    }
  }

  private async downloadToLocal(
    filePath: string,
    fetchedObjects: object | object[]
  ) {
    console.log(`Uploading ${filePath} to local file system`);
    try {
      if (!fs.existsSync('extracted_files')) {
        fs.mkdirSync('extracted_files');
      }

      const timestamp = new Date().getTime();
      const fileHandle = await fsPromises.open(
        `extracted_files/${timestamp}_${filePath}`,
        'w'
      );
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
      console.error('Error writing data to file:', error);
      return Promise.reject(error);
    }
  }
}
