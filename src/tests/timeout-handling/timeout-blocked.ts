import { processExtractionTask } from '../../index';

processExtractionTask({
  // eslint-disable-next-line @typescript-eslint/require-await
  task: async () => {
    // Simple CPU-intensive nested loops that block the event loop
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      for (let j = 0; j < 10000; j++) {
        result += Math.sqrt(i * j) * Math.sin(i + j);
        result = Math.abs(result) % 1000000;
      }

      // Log every 10000 iterations to show progress
      if (i % 10000 === 0) {
        console.log(`timeout-blocked iteration ${i}`);
      }
    }

    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return { status: 'progress' };
  },
});
