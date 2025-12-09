import { sleep } from '../../common/helpers';
import { ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    // CPU-intensive nested loops that yield control after logging
    // This allows the event loop to process timeout messages
    let result = 0;
    for (let i = 0; i < 100000; i++) {
      for (let j = 0; j < 10000; j++) {
        result += Math.sqrt(i * j) * Math.sin(i + j);
        result = Math.abs(result) % 1000000;
      }

      // Log every 10000 iterations and yield control to event loop
      if (i % 10000 === 0) {
        console.log(`timeout-unblocked iteration ${i}`);
        await sleep(100);
      }
    }

    await adapter.emit(ExtractorEventType.DataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
