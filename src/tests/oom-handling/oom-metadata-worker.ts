import { ExtractorEventType, processTask } from '../../index';

/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unused-vars */

/**
 * Worker that causes OOM during metadata extraction.
 * Tests OOM handling for EventType.StartExtractingMetadata.
 */
processTask({
  task: async ({ adapter }) => {
    console.log('OOM metadata worker starting');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryHog: any[] = [];

    while (true) {
      const chunk: { data: string; index: number }[] = [];
      for (let i = 0; i < 10000; i++) {
        chunk.push({
          data: 'metadata'.repeat(12),
          index: i,
        });
      }
      memoryHog.push(chunk);
    }
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.MetadataExtractionDone);
  },
});
