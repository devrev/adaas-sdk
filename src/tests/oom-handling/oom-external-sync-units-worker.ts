import { ExtractorEventType, processTask } from '../../index';

/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Worker that causes OOM during external sync units extraction.
 * Tests OOM handling for EventType.StartExtractingExternalSyncUnits.
 */
processTask({
  task: async ({ adapter }) => {
    console.log('OOM external sync units worker starting');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryHog: any[] = [];

    while (true) {
      const chunk: { data: string; index: number }[] = [];
      for (let i = 0; i < 10000; i++) {
        chunk.push({
          data: 'sync_unit'.repeat(11),
          index: i,
        });
      }
      memoryHog.push(chunk);
    }
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone);
  },
});
