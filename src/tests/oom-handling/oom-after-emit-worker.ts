import { ExtractorEventType, processTask } from '../../index';

/**
 * Worker that emits an event before causing an OOM error.
 * This tests the edge case where alreadyEmitted is true when OOM occurs.
 */
processTask({
  task: async ({ adapter }) => {
    console.log('OOM after emit worker - emitting progress first');

    // Emit a progress event BEFORE causing OOM
    await adapter.emit(ExtractorEventType.DataExtractionProgress);

    console.log('Progress emitted successfully, waiting a moment...');

    // Wait a bit to ensure the emit was fully processed
    await new Promise((resolve) => setTimeout(resolve, 100));

    console.log('Now causing OOM...');

    // Array to hold references to prevent garbage collection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryHog: any[] = [];

    // Allocate memory until OOM
    while (true) {
      const chunk: { data: string; index: number }[] = [];
      for (let i = 0; i < 10000; i++) {
        chunk.push({
          data: 'x'.repeat(100),
          index: i,
        });
      }
      memoryHog.push(chunk);
    }
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});

