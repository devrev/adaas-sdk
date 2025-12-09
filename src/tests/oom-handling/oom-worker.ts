import { ExtractorEventType, processTask } from '../../index';

/**
 * Worker that intentionally causes an OOM error by allocating large arrays.
 * This is used to test OOM detection and handling in the parent thread.
 *
 * Note: We use JavaScript arrays/objects to allocate V8 heap memory,
 * not Buffers (which use external memory and aren't limited by resourceLimits).
 */
processTask({
  task: async ({ adapter }) => {
    console.log('OOM worker starting - will intentionally cause OOM');

    // Array to hold references to prevent garbage collection
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const memoryHog: any[] = [];

    try {
      // Allocate memory in chunks until we run out
      // Each chunk is approximately 1MB of heap memory (array of objects)
      let totalAllocated = 0;

      while (true) {
        // Create an array of objects to consume V8 heap memory
        // Each object with strings consumes heap memory
        const chunk: { data: string; index: number }[] = [];
        for (let i = 0; i < 10000; i++) {
          chunk.push({
            data: 'x'.repeat(100), // 100 bytes per string
            index: i,
          });
        }
        memoryHog.push(chunk);
        totalAllocated += 1; // Approximately 1MB per chunk

        if (totalAllocated % 10 === 0) {
          console.log(
            `Allocated approximately ${totalAllocated}MB of heap memory`
          );
        }

        // Small delay to allow logging (but not too long to avoid timeout)
        if (totalAllocated % 50 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 1));
        }
      }
    } catch (error) {
      // This catch block may not be reached if OOM kills the process
      console.error('Error during memory allocation:', error);
      await adapter.emit(ExtractorEventType.DataExtractionError, {
        error: { message: 'Memory allocation failed' },
      });
    }
  },
  onTimeout: async ({ adapter }) => {
    // This should not be called in OOM scenario
    console.log('OOM worker timeout handler called');
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
