import { sleep } from '../../common/helpers';
import { ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    // Use async delays that allow the event loop to process timeout messages
    for (let i = 0; i < 10; i++) {
      console.log('timeout-graceful iteration', i);
      await sleep(5000);
    }

    await adapter.emit(ExtractorEventType.DataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
