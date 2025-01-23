import {
  ExternalSystemAttachmentStreamingParams,
  ExternalSystemAttachmentStreamingResponse,
} from 'types/extraction';
import {
  processTask,
  ExtractorEventType,
  serializeAxiosError,
} from '../../index';
import { axios, axiosClient } from '../../http/axios-client';

const getAttachmentStream = async ({
  item,
}: ExternalSystemAttachmentStreamingParams): Promise<ExternalSystemAttachmentStreamingResponse> => {
  const { id, url } = item;

  try {
    const fileStreamResponse = await axiosClient.get(url, {
      responseType: 'stream',
    });

    return { httpStream: fileStreamResponse };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        'Error while fetching attachment from URL.',
        serializeAxiosError(error)
      );
    } else {
      console.error('Error while fetching attachment from URL.', error);
    }
    return {
      error: {
        message: 'Error while fetching attachment ' + id + ' from URL.',
      },
    };
  }
};

processTask({
  task: async ({ adapter }) => {
    const { error, delay } = await adapter.streamAttachments({
      stream: getAttachmentStream,
    });

    if (delay) {
      await adapter.emit(ExtractorEventType.ExtractionAttachmentsDelay, {
        delay,
      });
    } else if (error) {
      await adapter.emit(ExtractorEventType.ExtractionAttachmentsError, {
        error,
      });
    }
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.postState();
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsProgress, {
      progress: 50,
    });
  },
});
