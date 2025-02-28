import { processTask } from '../process-task';
import { LoaderEventType } from '../../types';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.UnknownEventType, {
      error: {
        message:
          'Event type ' + adapter.event.payload.event_type + ' not supported.',
      },
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.postState();
    await adapter.emit(LoaderEventType.AttachmentLoadingError, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
});
