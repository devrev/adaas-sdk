import { AxiosResponse } from 'axios';
import { Readable } from 'stream';

import { processExtractionTask } from '../../index';
import { ExternalSystemAttachmentStreamingResponse } from '../../types/extraction';

// Repro for logs1.csv: stream() succeeds but the upload 5xxs, so axios-retry
// backs off (2s, 4s, ...) and a pool worker is stuck mid-retry across the soft
// timeout (it only re-checks the flag between attachments, never mid-retry).
processExtractionTask({
  task: async ({ adapter }) => {
    return adapter.streamAttachments({
      stream: async (): Promise<ExternalSystemAttachmentStreamingResponse> => {
        await Promise.resolve();
        const body = Buffer.from('hello world');
        const data = Readable.from([body]);
        return {
          httpStream: {
            data,
            headers: {
              'content-type': 'text/plain',
              'content-length': String(body.length),
            },
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
