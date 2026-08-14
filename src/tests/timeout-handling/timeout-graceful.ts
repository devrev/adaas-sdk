import { sleep } from '../../common/helpers';
import { processExtractionTask } from '../../index';

processExtractionTask({
  task: async ({ adapter }) => {
    // Use async delays that allow the event loop to process timeout messages
    for (let i = 0; i < 10; i++) {
      if (adapter.isTimeout) {
        return { status: 'progress' };
      }

      console.log('timeout-graceful iteration', i);
      await sleep(1000);
    }

    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return { status: 'progress' };
  },
});
