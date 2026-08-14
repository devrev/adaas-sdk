import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { jsonl } from 'js-jsonl';

import { MAX_DEVREV_ARTIFACT_SIZE } from '../common/constants';
import { axiosClient } from '../http/client';
import { serializeError } from '../logger/logger';
import { NormalizedAttachment } from '../repo/repo.interfaces';
import { HttpStreamResponse } from '../types/extraction';

import {
  compressGzip,
  computeArtifactDateRanges,
  decompressGzip,
  downloadToLocal,
  parseJsonl,
  truncateFilename,
} from './uploader.helpers';
import {
  Artifact,
  ArtifactToUpload,
  UploaderFactoryInterface,
  UploaderResult,
  UploadResponse,
} from './uploader.interfaces';

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

  /** Compresses fetched objects to gzipped JSONL and uploads them as an artifact. */
  async upload(
    itemType: string,
    fetchedObjects: object[] | object
  ): Promise<UploadResponse> {
    if (this.isLocalDevelopment) {
      await downloadToLocal(itemType, fetchedObjects);
    }
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

    // Skip confirmation for External Sync Units: confirmation attaches the upload
    // to the sync, which doesn't exist yet when extracting External Sync Units.
    if (!this.skipConfirmation) {
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

    const artifactDateRanges = computeArtifactDateRanges(fetchedObjects);

    const artifact: Artifact = {
      id: preparedArtifact!.artifact_id,
      item_type: itemType,
      item_count: Array.isArray(fetchedObjects) ? fetchedObjects.length : 1,
      ...artifactDateRanges,
    };

    return { artifact };
  }

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

  /** Uploads the file buffer to the artifact's upload URL as multipart form data. */
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

  /** Streams a file from an HTTP response directly to the artifact's upload URL. */
  async streamArtifact(
    artifact: ArtifactToUpload,
    fileStream: HttpStreamResponse
  ): Promise<UploaderResult<AxiosResponse>> {
    const formData = new FormData();
    for (const field in artifact.form_data) {
      formData.append(field, artifact.form_data[field]);
    }
    formData.append('file', fileStream.data);

    const hasContentLength = !!fileStream.headers['content-length'];

    try {
      const response = await axiosClient.post(artifact.upload_url, formData, {
        headers: {
          ...formData.getHeaders(),
          // S3 presigned uploads don't support chunked transfer-encoding, so
          // Content-Length must be set even when the real size is unknown.
          ...(!hasContentLength
            ? {
                'Content-Length': MAX_DEVREV_ARTIFACT_SIZE,
              }
            : {}),
        },
        // Prevents buffering of the response in memory
        maxRedirects: 0,
        // 2xx and 3xx are success; 4xx/5xx throw into the catch block
        validateStatus: (status) => status >= 200 && status < 400,
        // The fallback Content-Length is a guess, so the upload hits the same
        // ECONNABORTED timeout on every attempt — retrying only multiplies the delay.
        ...(!hasContentLength ? { 'axios-retry': { retries: 0 } } : {}),
      });
      this.destroyStream(fileStream);
      return { response };
    } catch (error) {
      this.destroyStream(fileStream);
      return { error };
    }
  }

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

  private destroyStream(fileStream: HttpStreamResponse): void {
    try {
      if (fileStream && fileStream.data) {
        // For axios response streams, `data` holds the actual stream
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

  /** Downloads an artifact and parses it into attachment metadata. */
  async getAttachmentsFromArtifactId({
    artifact,
  }: {
    artifact: string;
  }): Promise<{
    attachments?: NormalizedAttachment[];
    error?: { message: string };
  }> {
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

  /** Downloads an artifact (optionally gzipped) and parses it as JSONL. */
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
