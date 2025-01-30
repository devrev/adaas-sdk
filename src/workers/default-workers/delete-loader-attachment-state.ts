import { processTask, LoaderEventType } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.LoaderAttachmentStateDeletionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.LoaderAttachmentStateDeletionError, {
      error: {
        message: 'Failed to delete attachment state. Timeout.',
      },
    });
  },
});
