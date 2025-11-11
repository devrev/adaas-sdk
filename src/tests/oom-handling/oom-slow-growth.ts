import { ExtractorEventType, processTask } from '../../index';

/**
 * OOM Test Worker: Slow Heap Growth
 * 
 * This worker simulates slow, gradual memory growth by allocating
 * memory in small chunks with delays between allocations.
 * 
 * This tests that the memory monitor can detect and handle
 * gradual memory increases before hitting hard OOM.
 */

processTask({
  task: async ({ adapter }) => {
    console.log('🐌 Starting slow heap growth test...');

    const chunks: any[] = [];
    const objectsPerIteration = 100_000; // 100k objects per iteration
    const delayMs = 100; // 100ms between allocations

    try {
      for (let i = 0; i < 100; i++) {
        // Allocate many small objects to fill the heap
        // This prevents GC from collecting them immediately
        const batch = [];
        for (let j = 0; j < objectsPerIteration; j++) {
          batch.push({
            id: i * objectsPerIteration + j,
            data: 'x'.repeat(100), // Small string per object
            timestamp: Date.now(),
            nested: { value: Math.random() },
          });
        }
        chunks.push(batch);

        const memUsage = process.memoryUsage();
        const heapUsedMB = (memUsage.heapUsed / 1024 / 1024).toFixed(0);
        const heapTotalMB = (memUsage.heapTotal / 1024 / 1024).toFixed(0);

        console.log(`   Iteration ${i + 1}: Allocated ${heapUsedMB}MB / ${heapTotalMB}MB`);

        // Small delay to allow memory monitor to check
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }

      // If we get here, we didn't hit the memory threshold
      console.log('✅ Completed without hitting memory threshold');
      await adapter.emit(ExtractorEventType.ExtractionDataDone);
    } catch (error) {
      console.error('❌ Error during slow growth test:', error);
      throw error;
    }
  },
  onTimeout: async ({ adapter }) => {
    console.log('⏱️  Timeout handler called');
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});

