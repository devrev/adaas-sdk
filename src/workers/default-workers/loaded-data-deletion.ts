import { processTask, LoaderEventType } from '../../index';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.LoaderStateDeletionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.LoaderStateDeletionError, {
      error: {
        message: 'Failed to delete data. Lambda timeout.',
      },
    });
  },
});
