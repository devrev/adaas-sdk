import { sleep } from '../../common/helpers';
import { processExtractionTask } from '../../index';

processExtractionTask({
  task: async ({ adapter }) => {
    // CPU-intensive loops that periodically yield so the event loop can
    // process timeout messages
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      for (let j = 0; j < 10000; j++) {
        if (adapter.isTimeout) {
          return { status: 'progress' };
        }

        result += Math.sqrt(i * j) * Math.sin(i + j);
        result = Math.abs(result) % 1000000;
      }

      if (i % 1000 === 0) {
        console.log(`timeout-unblocked iteration ${i}`);
        await sleep(0);
      }
    }

    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return { status: 'progress' };
  },
});
