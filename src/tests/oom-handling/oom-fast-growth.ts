import { ExtractorEventType, processTask } from '../../index';

/**
 * OOM Test Worker: Fast Heap Growth
 * 
 * This worker simulates rapid memory growth by allocating
 * large amounts of memory quickly without delays.
 * 
 * This tests the edge case where memory grows so fast that
 * the worker may hit the resource limit before the memory
 * monitor can detect it. This is expected behavior - the
 * resource limit acts as a safety net.
 */

processTask({
  task: async ({ adapter }) => {
    console.log('🚀 Starting fast heap growth test...');

    const chunks: any[] = [];
    const objectsPerIteration = 25000; // 25k objects per iteration (fast but controlled growth)

    try {
      for (let i = 0; i < 100; i++) {
        // Allocate many small objects rapidly to fill the heap
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
      }

      // If we get here, we didn't hit the memory threshold
      console.log('✅ Completed without hitting memory threshold');
      await adapter.emit(ExtractorEventType.ExtractionDataDone);
    } catch (error) {
      console.error('❌ Error during fast growth test:', error);
      throw error;
    }
  },
  onTimeout: async ({ adapter }) => {
    console.log('⏱️  Timeout handler called');
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});

