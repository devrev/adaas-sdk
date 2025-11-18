import { ExtractorEventType, processTask } from '../../index';

/**
 * Deterministic worker that simulates an OOM crash by throwing an error whose
 * message matches what the parent process looks for. This avoids actually
 * exhausting memory (which is flaky in CI) while still exercising the
 * worker-error path.
 */

processTask({
  task: async ({ adapter }) => {
    console.log('🔁 Simulating sustained allocations before crash...');

    const allocations: Buffer[] = [];

    for (let i = 0; i < 32; i++) {
      // Keep some pressure on the heap so resource limits are exercised.
      allocations.push(Buffer.alloc(512 * 1024, i));

      if (i % 8 === 0) {
        await adapter.emit(ExtractorEventType.ExtractionDataProgress);
      }
    }

    // Crash with an OOM-like error so the parent detects it deterministically.
    throw new Error('Simulated out of memory condition for integration tests');
  },
  onTimeout: async ({ adapter }) => {
    console.log('⏱️ Timeout handler invoked unexpectedly');
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});
