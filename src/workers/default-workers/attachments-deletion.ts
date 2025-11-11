import { ExtractorEventTypeV2, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(ExtractorEventTypeV2.ExtractionAttachmentsDeleteDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventTypeV2.ExtractionAttachmentsDeleteError, {
      error: { message: 'Failed to delete attachments. Lambda timeout.' },
    });
  },
});
