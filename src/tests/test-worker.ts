import { processTask } from '../workers/process-task';
import { ExtractorEventType } from '../types/extraction';
import { ErrorRecord } from '../types/common';

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsDone, {});
    return 0;
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsError, {
      error: { message: 'External sync unit failed.' } as ErrorRecord,
    });
    return 0;
  },
});
