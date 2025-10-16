import axios, { AxiosResponse } from 'axios';
import { MAX_DEVREV_ARTIFACT_SIZE } from '../../common/constants';
import { ExtractorEventType, processTask } from '../../index';
import {
  ExternalSystemAttachmentStreamingParams,
  ExternalSystemAttachmentStreamingResponse,
} from '../../types/extraction';

const getAttachmentStream = async ({
  item,
}: ExternalSystemAttachmentStreamingParams): Promise<ExternalSystemAttachmentStreamingResponse> => {
  const { id, url } = item;
  let fileStreamResponse: AxiosResponse | undefined;

  try {
    // Get the stream response directly
    fileStreamResponse = await axios.get(url, {
      responseType: 'stream',
      headers: {
        'Accept-Encoding': 'identity',
      },
    });

    // Check content-length from the stream response headers
    const contentLength = fileStreamResponse?.headers['content-length'];
    if (contentLength && parseInt(contentLength) > MAX_DEVREV_ARTIFACT_SIZE) {
      console.warn(
        `Attachment ${id} size (${contentLength} bytes) exceeds maximum limit of ${MAX_DEVREV_ARTIFACT_SIZE} bytes. Skipping download.`
      );

      // Destroy the stream since we won't use it
      if (fileStreamResponse != null) {
        destroyHttpStream(fileStreamResponse);
      }

      return {
        error: {
          message: `File size exceeds maximum limit of ${MAX_DEVREV_ARTIFACT_SIZE} bytes.`,
        },
      };
    }

    return { httpStream: fileStreamResponse };
  } catch (error) {
    // If we created a stream but failed afterwards, destroy it
    if (fileStreamResponse != null) {
      destroyHttpStream(fileStreamResponse);
    }

    return {
      error: {
        message: `Error while getting attachment stream for attachment with id ${id}. ${error}`,
      },
    };
  }
};

/**
 * Destroys a stream to prevent memory leaks.
 * @param {any} httpStream - The axios response stream to destroy
 */
const destroyHttpStream = (httpStream: AxiosResponse): void => {
  try {
    if (httpStream && httpStream.data) {
      if (typeof httpStream.data.destroy === 'function') {
        httpStream.data.destroy();
      } else if (typeof httpStream.data.close === 'function') {
        httpStream.data.close();
      }
    }
  } catch (error) {
    console.warn('Error while destroying HTTP stream:', error);
  }
};

processTask({
  task: async ({ adapter }) => {
    try {
      const response = await adapter.streamAttachments({
        stream: getAttachmentStream,
        batchSize: 10,
      });

      if (response?.delay) {
        await adapter.emit(ExtractorEventType.ExtractionAttachmentsDelay, {
          delay: response.delay,
        });
      } else if (response?.error) {
        await adapter.emit(ExtractorEventType.ExtractionAttachmentsError, {
          error: response.error,
        });
      } else {
        await adapter.emit(ExtractorEventType.ExtractionAttachmentsDone);
      }
    } catch (error) {
      console.error('An error occured while processing a task.', error);
    }
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsProgress);
  },
});
