import { processTask, ExtractorEventType } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionDataDeleteDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionDataDeleteError, {
      error: {
        message: 'Failed to delete data. Lambda timeout.',
      },
    });
  },
});
