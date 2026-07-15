import { AxiosResponse } from 'axios';
import { Readable } from 'stream';

import { processExtractionTask } from '../../index';
import {
  ExternalSystemAttachmentStreamingResponse,
  ExternalSystemAttachmentStreamingParams,
} from '../../types/extraction';

// Repro for logs2.csv: one attachment's stream() hangs forever, keeping a pool
// worker (and streamAll) pending past the soft timeout.
processExtractionTask({
  task: async ({ adapter }) => {
    return adapter.streamAttachments({
      stream: async ({
        item,
      }: ExternalSystemAttachmentStreamingParams): Promise<ExternalSystemAttachmentStreamingResponse> => {
        if (item.id === 'att-hangs') {
          await new Promise<void>(() => {});
        }

        const data = Readable.from([Buffer.from('hello world')]);
        return {
          httpStream: {
            data,
            headers: { 'content-type': 'text/plain', 'content-length': '11' },
          } as unknown as AxiosResponse,
        };
      },
      batchSize: 10,
    });
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return { status: 'progress' };
  },
});
