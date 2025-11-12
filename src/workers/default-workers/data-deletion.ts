import { ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractorStateDeletionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractorStateDeletionError, {
      error: {
        message: 'Failed to delete data. Lambda timeout.',
      },
    });
  },
});
