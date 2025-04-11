import { processTask } from '../process-task';
import { LoaderEventType } from '../../types/loading';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.DataLoadingDone, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.DataLoadingError, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
});
