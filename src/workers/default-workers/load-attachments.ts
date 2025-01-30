import { processTask } from 'workers/process-task';
import { LoaderEventType } from 'types';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.AttachmentLoadingDone, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
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
