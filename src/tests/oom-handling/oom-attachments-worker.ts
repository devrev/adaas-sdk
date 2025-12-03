import { ExtractorEventType, processTask } from '../../index';

/**
 * Worker that causes OOM during attachments extraction.
 * Tests OOM handling for EventType.StartExtractingAttachments.
 */
processTask({
  task: async ({ adapter }) => {
    console.log('OOM attachments worker starting');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryHog: any[] = [];

    while (true) {
      const chunk: { data: string; index: number }[] = [];
      for (let i = 0; i < 10000; i++) {
        chunk.push({
          data: 'attachment'.repeat(10),
          index: i,
        });
      }
      memoryHog.push(chunk);
    }
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.AttachmentsExtractionProgress);
  },
});

