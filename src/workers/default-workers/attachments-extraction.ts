import axios from 'axios';
import {
  ExternalSystemAttachmentStreamingParams,
  ExternalSystemAttachmentStreamingResponse,
} from 'types/extraction';
import {
  processTask,
  ExtractorEventType,
  serializeAxiosError,
} from '../../index';
import { axiosClient } from '../../http/axios-client-internal';
import { MAX_DEVREV_ARTIFACT_SIZE } from '../../common/constants';

const getAttachmentStream = async ({
  item,
}: ExternalSystemAttachmentStreamingParams): Promise<ExternalSystemAttachmentStreamingResponse> => {
  const { id, url } = item;
  let fileStreamResponse: any = null;

  try {
    // First, check file size with HEAD request to avoid downloading large files
    const headResponse = await axiosClient.head(url, {
      headers: {
        'Accept-Encoding': 'identity',
      },
    });

    const contentLength = headResponse.headers['content-length'];
    if (contentLength && parseInt(contentLength) > MAX_DEVREV_ARTIFACT_SIZE) {
      console.warn(
        `Attachment ${id} size (${contentLength} bytes) exceeds maximum limit of ${MAX_DEVREV_ARTIFACT_SIZE} bytes. Skipping download.`
      );
      return {
        error: {
          message: `File size exceeds maximum limit of ${MAX_DEVREV_ARTIFACT_SIZE} bytes.`,
        },
      };
    }

    // If size is acceptable, proceed with streaming
    fileStreamResponse = await axiosClient.get(url, {
      responseType: 'stream',
      headers: {
        'Accept-Encoding': 'identity',
      },
    });

    return { httpStream: fileStreamResponse };
  } catch (error) {
    // If we created a stream but failed afterwards, destroy it
    if (fileStreamResponse) {
      destroyHttpStream(fileStreamResponse);
    }

    if (axios.isAxiosError(error)) {
      console.warn(
        `Error while fetching attachment ${id} from URL.`,
        serializeAxiosError(error)
      );
      console.warn('Failed attachment metadata', item);
    } else {
      console.warn(`Error while fetching attachment ${id} from URL.`, error);
      console.warn('Failed attachment metadata', item);
    }

    return {
      error: {
        message: 'Error while fetching attachment ' + id + ' from URL.',
      },
    };
  }
};

/**
 * Destroys a stream to prevent memory leaks.
 * @param {any} httpStream - The axios response stream to destroy
 */
const destroyHttpStream = (httpStream: any): void => {
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
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsProgress, {
      progress: 50,
    });
  },
});
