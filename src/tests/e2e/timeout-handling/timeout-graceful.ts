import { ExtractorEventType, processTask } from '../../../index';

processTask({
  task: async ({ adapter }) => {
    // Use async delays that allow the event loop to process timeout messages
    for (let i = 0; i < 10; i++) {
      console.log('timeout-graceful iteration', i);
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    await adapter.emit(ExtractorEventType.ExtractionDataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});
