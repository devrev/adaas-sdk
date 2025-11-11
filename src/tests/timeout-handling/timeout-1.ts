import { ExtractorEventTypeV2, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    for (let i = 0; i < 10; i++) {
      console.log('timeout-1 iteration', i);
    }

    await adapter.emit(ExtractorEventTypeV2.ExtractionDataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventTypeV2.ExtractionDataProgress);
  },
});
