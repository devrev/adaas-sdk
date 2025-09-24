import { ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    for (let i = 0; i < 10; i++) {
      console.log(`Simple worker iteration: ${i}.`);
    }

    await adapter.emit(ExtractorEventType.ExtractionDataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});
