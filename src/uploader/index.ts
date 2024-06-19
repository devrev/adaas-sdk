import axios from 'axios';

import { betaSDK, client } from '@devrev/typescript-sdk';

import { createFormData } from '../adapter/helpers';
import { Artifact, UploadResponse } from '../types/common';

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
 */
export class Uploader {
  private betaDevrevSdk;
  private publicDevrevSdk;

  constructor(endpoint: string, token: string) {
    this.betaDevrevSdk = client.setupBeta({
      endpoint,
      token,
    });
    this.publicDevrevSdk = client.setup({ endpoint, token });
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
      throw new Error('Error while fetching upload url: ' + error);
    }
  }

  private async uploadToArtifact(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    preparedArtifact: any,
    fetchedObjects: object[] | object
  ): Promise<any | null> {
    const formData = createFormData(preparedArtifact, fetchedObjects);
    try {
      const response = await axios.post(preparedArtifact.url, formData, {
        headers: {
          'Content-Type': 'multipart/form',
        },
      });

      return response;
    } catch (error) {
      console.error('Error while uploading artifact: ' + error);
      return null;
    }
  }
}
