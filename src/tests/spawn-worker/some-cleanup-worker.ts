import { ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    console.log('Some cleanup logic executed.');
    await adapter.emit(ExtractorEventType.ExtractorStateDeletionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractorStateDeletionError, {
      error: {
        message: 'Failed to execute cleanup logic. Lambda timeout.',
      },
    });
  },
});
