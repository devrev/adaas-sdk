import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import fs, { promises as fsPromises } from 'fs';
import { jsonl } from 'js-jsonl';
import { truncateFilename } from '../../common/helpers';
import { axiosClient } from '../../http/axios-client-internal';
import { Artifact, UploadResponse } from '../../uploader/uploader.interfaces';
import { serializeError } from '../../logger/logger';

interface PreparedArtifact {
  upload_url: string;
  artifact_id: string;
  form_data: Array<{ key: string; value: string }>;
}

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
  private devrevApiEndpoint: string;
  private devrevApiToken: string;
  private defaultHeaders: Record<string, string>;
  private local: boolean;
  constructor(endpoint: string, token: string, local = false) {
    this.devrevApiEndpoint = endpoint;
    this.devrevApiToken = token;
    this.defaultHeaders = {
      Authorization: `Bearer ${this.devrevApiToken}`,
    };
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
      id: preparedArtifact.artifact_id,
      item_type: entity,
      item_count: itemCount,
    };

    console.log(`Artifact uploaded successfully: ${artifact.id}`);

    return { artifact, error: undefined };
  }

  private async prepareArtifact(
    filename: string,
    filetype: string
  ): Promise<PreparedArtifact | null> {
    try {
      const response = await axiosClient.get(
        `${this.devrevApiEndpoint}/internal/airdrop.artifacts.upload-url`,
        {
          headers: {
            ...this.defaultHeaders,
          },
          params: {
            file_name: truncateFilename(filename),
            file_type: filetype,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error(
        'Error while preparing artifact: ' + serializeError(error)
      );
      return null;
    }
  }

  private async uploadToArtifact(
    preparedArtifact: PreparedArtifact,
    fetchedObjects: object[] | object
  ): Promise<AxiosResponse | null> {
    const formData = new FormData();
    for (const item of preparedArtifact.form_data) {
      formData.append(item.key, item.value);
    }

    formData.append('file', jsonl.stringify(fetchedObjects));

    try {
      const response = await axiosClient.post(
        preparedArtifact.upload_url,
        formData,
        {
          headers: {
            ...formData.getHeaders(),
          },
        }
      );

      return response;
    } catch (error) {
      console.error(
        'Error while uploading artifact: ' + serializeError(error)
      );
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
