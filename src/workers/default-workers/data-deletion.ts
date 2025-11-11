import { ExtractorEventTypeV2, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(ExtractorEventTypeV2.ExtractionDataDeleteDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventTypeV2.ExtractionDataDeleteError, {
      error: {
        message: 'Failed to delete data. Lambda timeout.',
      },
    });
  },
});
