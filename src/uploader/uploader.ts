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
  UploaderResult,
} from './uploader.interfaces';

/**
 * Uploads extraction artifacts to the DevRev platform and reads them back.
 *
 * Used to compress and upload JSON batches and streamed attachment binaries, obtain upload/download
 * URLs, confirm uploads, and download and parse previously uploaded artifacts during sync.
 */
export class Uploader {
  private isLocalDevelopment?: boolean;
  private devrevApiEndpoint: string;
  private devrevApiToken: string;
  private requestId: string;
  private defaultHeaders: Record<string, string>;
  private skipConfirmation: boolean;

  constructor({ event, options }: UploaderFactoryInterface) {
    this.devrevApiEndpoint = event.execution_metadata.devrev_endpoint;
    this.devrevApiToken = event.context.secrets.service_account_token;
    this.requestId = event.payload.event_context.request_id;
    this.isLocalDevelopment = options?.isLocalDevelopment;
    this.skipConfirmation = options?.skipConfirmation ?? false;
    this.defaultHeaders = {
      Authorization: `Bearer ${this.devrevApiToken}`,
    };
  }

  /**
   * Uploads fetched objects to the DevRev platform as a single artifact.
   *
   * Used to compress the objects into a gzipped JSONL file, request an upload URL, push the file, and
   * (unless skipped) confirm the upload, returning the resulting artifact descriptor.
   *
   * @param itemType - The string item type of the objects being uploaded.
   * @param fetchedObjects - The object or array of objects to upload.
   * @returns Promise resolving to an UploadResponse with the artifact descriptor, or an error message on failure.
   */
  async upload(
    itemType: string,
    fetchedObjects: object[] | object
  ): Promise<UploadResponse> {
    if (this.isLocalDevelopment) {
      await downloadToLocal(itemType, fetchedObjects);
    }
    // Compress the fetched objects to a gzipped jsonl object
    const { response: file, error: fileError } = compressGzip(
      jsonl.stringify(fetchedObjects)
    );
    if (fileError) {
      return {
        error: {
          message:
            'Error while compressing jsonl object. ' +
            serializeError(fileError),
        },
      };
    }

    const filename = itemType + '.jsonl.gz';
    const fileType = 'application/x-gzip';

    // Get upload url
    const { error: preparedArtifactError, response: preparedArtifact } =
      await this.getArtifactUploadUrl(filename, fileType);
    if (preparedArtifactError) {
      return {
        error: {
          message:
            'Error while getting artifact upload URL: ' +
            serializeError(preparedArtifactError),
        },
      };
    }

    // Upload prepared artifact to the given url
    const { error: uploadItemError } = await this.uploadArtifact(
      preparedArtifact!,
      file!
    );
    if (uploadItemError) {
      return {
        error: {
          message:
            'Error while uploading artifact: ' +
            serializeError(uploadItemError),
        },
      };
    }

    // Skip confirmation for External Sync Units, as this confirmation attachments
    // uploads to the sync, which we haven't created yet when extracting External Sync Units.
    if (!this.skipConfirmation) {
      // Confirm upload
      const { error: confirmArtifactUploadError } =
        await this.confirmArtifactUpload(preparedArtifact!.artifact_id);
      if (confirmArtifactUploadError) {
        return {
          error: {
            message:
              'Error while confirming artifact upload. ' +
              JSON.stringify(confirmArtifactUploadError),
          },
        };
      }
    }

    // Return the artifact information to the platform
    const artifact: Artifact = {
      id: preparedArtifact!.artifact_id,
      item_type: itemType,
      item_count: Array.isArray(fetchedObjects) ? fetchedObjects.length : 1,
    };

    return { artifact };
  }

  /**
   * Requests a pre-signed upload URL and form data for a new artifact.
   *
   * Used before uploading or streaming a file so the binary can be POSTed to the returned URL.
   *
   * @param filename - The string file name to register (truncated if it exceeds the platform limit).
   * @param fileType - The string MIME type of the file.
   * @param fileSize - Optional number of bytes; rejected if 0 or less.
   * @returns Promise resolving to an UploaderResult wrapping the ArtifactToUpload, or an error on failure.
   */
  async getArtifactUploadUrl(
    filename: string,
    fileType: string,
    fileSize?: number
  ): Promise<UploaderResult<ArtifactToUpload>> {
    const url = `${this.devrevApiEndpoint}/internal/airdrop.artifacts.upload-url`;

    if (fileSize !== undefined && fileSize <= 0) {
      return {
        error: { message: 'File size is 0 or less.' },
      };
    }

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
      return { response: response.data };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Uploads an in-memory file buffer to a pre-signed artifact upload URL.
   *
   * Used to push a fully buffered artifact (e.g. a compressed JSON batch) as multipart form data.
   *
   * @param artifact - The ArtifactToUpload descriptor holding the upload URL and form fields.
   * @param file - The Buffer containing the file contents to upload.
   * @returns Promise resolving to an UploaderResult wrapping the AxiosResponse, or an error on failure.
   */
  async uploadArtifact(
    artifact: ArtifactToUpload,
    file: Buffer
  ): Promise<UploaderResult<AxiosResponse>> {
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
      return { response };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Streams a file directly from a source response into a pre-signed artifact upload URL.
   *
   * Used to upload attachment binaries without buffering them in memory; falls back to the max
   * artifact size for Content-Length when the source omits it, and always destroys the source stream.
   *
   * @param artifact - The ArtifactToUpload descriptor holding the upload URL and form fields.
   * @param fileStream - The AxiosResponse whose data stream supplies the file contents.
   * @returns Promise resolving to an UploaderResult wrapping the AxiosResponse, or an error on failure.
   */
  async streamArtifact(
    artifact: ArtifactToUpload,
    fileStream: AxiosResponse
  ): Promise<UploaderResult<AxiosResponse>> {
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
      return { response };
    } catch (error) {
      this.destroyStream(fileStream);
      return { error };
    }
  }

  /**
   * Confirms with the platform that an artifact upload has finished.
   *
   * Used after pushing the binary so the platform finalizes and accepts the artifact.
   *
   * @param artifactId - The string ID of the uploaded artifact to confirm.
   * @returns Promise resolving to an object with the AxiosResponse on a 2xx, or an error otherwise.
   */
  async confirmArtifactUpload(artifactId: string): Promise<{
    response?: AxiosResponse;
    error?: unknown;
  }> {
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

      // If response exists and the status is 2xx, return the response
      if (response?.status >= 200 && response?.status < 300) {
        return { response };
      } else {
        return {
          error: {
            message:
              'Error while confirming artifact upload. ' +
              serializeError(response),
          },
        };
      }
    } catch (error) {
      return { error: { message: serializeError(error) } };
    }
  }

  /**
   * Destroys a source stream to prevent resource leaks after streaming an artifact.
   *
   * Used internally by streamArtifact to close the AxiosResponse data stream on both success and error.
   *
   * @param fileStream - The AxiosResponse whose underlying data stream should be destroyed/closed.
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
   * Downloads an attachments-metadata artifact and parses it into normalized attachments.
   *
   * Used during attachment extraction to read back the previously uploaded attachment metadata so its
   * binaries can be streamed; resolves the download URL, downloads, gunzips, and parses the JSONL.
   *
   * @param param0 - Object with `artifact`, the string artifact ID of the attachments-metadata artifact.
   * @returns Promise resolving to an object with the NormalizedAttachment array, or an error message on failure.
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
    const { response: artifactUrl, error: artifactUrlError } =
      await this.getArtifactDownloadUrl(artifact);

    if (artifactUrlError) {
      return {
        error: {
          message:
            'Error while getting artifact download URL. ' +
            serializeError(artifactUrlError),
        },
      };
    }

    // Download artifact from the URL
    const { response: gzippedJsonlObject, error: gzippedJsonlObjectError } =
      await this.downloadArtifact(artifactUrl!);
    if (gzippedJsonlObjectError) {
      return {
        error: {
          message:
            'Error while downloading gzipped jsonl object. ' +
            serializeError(gzippedJsonlObjectError),
        },
      };
    }

    // Decompress the gzipped jsonl object
    const { response: jsonlObject, error: jsonlObjectError } = decompressGzip(
      gzippedJsonlObject!
    );
    if (jsonlObjectError) {
      return {
        error: {
          message:
            'Error while decompressing gzipped jsonl object. ' +
            serializeError(jsonlObjectError),
        },
      };
    }

    // Parse the jsonl object to get the attachment metadata
    const { response: jsonObject, error: jsonObjectError } = parseJsonl(
      jsonlObject!
    );
    if (jsonObjectError) {
      return {
        error: {
          message:
            'Error while parsing jsonl object. ' +
            serializeError(jsonObjectError),
        },
      };
    }

    return { attachments: jsonObject! as NormalizedAttachment[] };
  }

  /**
   * Requests a pre-signed download URL for an artifact from the platform.
   *
   * Used internally before downloading an artifact's contents back from object storage.
   *
   * @param artifactId - The string ID of the artifact to download.
   * @returns Promise resolving to an UploaderResult wrapping the download URL string, or an error on failure.
   */
  private async getArtifactDownloadUrl(
    artifactId: string
  ): Promise<UploaderResult<string>> {
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

      return { response: response.data.download_url };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Downloads an artifact's raw bytes from a pre-signed URL.
   *
   * Used internally to fetch artifact contents as a Buffer for later decompression and parsing.
   *
   * @param artifactUrl - The string pre-signed URL to download the artifact from.
   * @returns Promise resolving to an UploaderResult wrapping the file Buffer, or an error on failure.
   */
  private async downloadArtifact(
    artifactUrl: string
  ): Promise<UploaderResult<Buffer>> {
    try {
      const response = await axiosClient.get(artifactUrl, {
        responseType: 'arraybuffer',
      });

      return { response: response.data };
    } catch (error) {
      return { error };
    }
  }

  /**
   * Downloads an artifact by ID and parses its JSONL contents into objects.
   *
   * Used to read back a previously uploaded JSON batch; optionally gunzips the bytes first.
   *
   * @param param0 - Object with `artifactId` (string artifact ID) and optional `isGzipped` (boolean, default false) flag.
   * @returns Promise resolving to an UploaderResult wrapping the parsed object or object array, or an error on failure.
   */
  async getJsonObjectByArtifactId({
    artifactId,
    isGzipped = false,
  }: {
    artifactId: string;
    isGzipped?: boolean;
  }): Promise<UploaderResult<object[] | object>> {
    const { response: artifactUrl, error: artifactUrlError } =
      await this.getArtifactDownloadUrl(artifactId);
    if (artifactUrlError) {
      return { error: artifactUrlError };
    }

    const { response: artifact, error: artifactError } =
      await this.downloadArtifact(artifactUrl!);
    if (artifactError) {
      return { error: artifactError };
    }

    if (isGzipped) {
      const {
        response: decompressedArtifact,
        error: decompressedArtifactError,
      } = decompressGzip(artifact!);
      if (decompressedArtifactError) {
        return { error: decompressedArtifactError };
      }

      const jsonlObject = Buffer.from(decompressedArtifact!).toString('utf-8');
      return { response: jsonl.parse(jsonlObject) };
    }

    const jsonlObject = Buffer.from(artifact!).toString('utf-8');
    return { response: jsonl.parse(jsonlObject) };
  }
}
