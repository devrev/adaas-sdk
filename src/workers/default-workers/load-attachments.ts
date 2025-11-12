import { LoaderEventType } from '../../types';
import { processTask } from '../process-task';

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
    await adapter.emit(LoaderEventType.AttachmentsLoadingError, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
});
