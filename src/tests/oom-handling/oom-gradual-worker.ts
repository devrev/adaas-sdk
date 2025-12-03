import { ExtractorEventType, processTask } from '../../index';

/**
 * Worker that gradually consumes memory to simulate a memory leak.
 * This is a more realistic OOM scenario than rapid allocation.
 */
processTask({
  task: async ({ adapter }) => {
    console.log('Gradual OOM worker starting - simulating memory leak');

    // Array to hold references to prevent garbage collection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryHog: any[] = [];
    let totalAllocated = 0;

    try {
      // Allocate memory gradually with delays to simulate real processing
      while (true) {
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 10));

        // Create smaller chunks to simulate gradual memory growth
        const chunk: { data: string; timestamp: number; index: number }[] = [];
        for (let i = 0; i < 2000; i++) {
          chunk.push({
            data: 'leak'.repeat(50), // ~200 bytes per string
            timestamp: Date.now(),
            index: i,
          });
        }
        memoryHog.push(chunk);
        totalAllocated++;

        if (totalAllocated % 5 === 0) {
          console.log(`Gradual allocation: ~${totalAllocated * 0.4}MB consumed`);
        }
      }
    } catch (error) {
      console.error('Error during gradual memory allocation:', error);
      await adapter.emit(ExtractorEventType.DataExtractionError, {
        error: { message: 'Gradual memory allocation failed' },
      });
    }
  },
  onTimeout: async ({ adapter }) => {
    console.log('Gradual OOM worker timeout handler called');
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});

