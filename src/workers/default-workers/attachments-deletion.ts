import { processTask, ExtractorEventType } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsDeleteDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionAttachmentsDeleteError, {
      error: { message: 'Failed to delete attachments. Lambda timeout.' },
    });
  },
});
