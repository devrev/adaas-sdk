import { ExtractorEventType, processExtractionTask } from '../../index';

processExtractionTask({
  task: async ({ adapter }) => {
    for (let i = 0; i < 10; i++) {
      console.log('no-timeout iteration', i);
    }

    await adapter.emit(ExtractorEventType.DataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
