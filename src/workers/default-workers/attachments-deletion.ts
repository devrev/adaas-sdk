import { ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(
      ExtractorEventType.ExtractorAttachmentsStateDeletionDone
    );
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(
      ExtractorEventType.ExtractorAttachmentsStateDeletionError,
      {
        error: { message: 'Failed to delete attachments. Lambda timeout.' },
      }
    );
  },
});
