import { sleep } from '../../common/helpers';
import { ExtractorEventType, processTask } from '../../index';

/**
 * Test worker that triggers both size limit timeout AND real timeout.
 *
 * 1. First, pushes enough items to trigger the size limit (setting adapter.isTimeout = true)
 * 2. Then sleeps long enough for the real timeout message (WorkerMessageExit) to arrive
 *
 * Without the onTimeoutExecuted guard in process-task.ts, both the post-task
 * size limit check and the WorkerMessageExit handler would call onTimeout,
 * resulting in a double emit to the callback URL.
 *
 * With the guard, only one onTimeout executes and only one callback is made.
 */
processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos([
      {
        itemType: 'external_domain_metadata',
      },
    ]);

    const repo = adapter.getRepo('external_domain_metadata');
    if (!repo) {
      console.error('Repo not found after init');
      await adapter.emit(ExtractorEventType.DataExtractionError, {
        error: { message: 'Repo not found after init!' },
      });
      return;
    }

    // Generate 3000 items with batch size 1 = 3000 artifacts
    // This will trigger the size limit (~165KB > 160KB threshold)
    const items = [];
    for (let i = 0; i < 3000; i++) {
      items.push({
        id: `item-${i}`,
        name: `Item ${i}`,
        data: { value: i },
      });
    }

    console.log(`Pushing ${items.length} items to trigger size limit...`);

    // Push items - this triggers the size limit during upload
    await repo.push(items);

    console.log(
      'Size limit triggered. Now sleeping to allow real timeout message to arrive...'
    );

    // Sleep long enough for the 3-second timeout to fire from spawn,
    // which sends WorkerMessageExit to the worker
    await sleep(5000);

    // This emit should be blocked because isTimeout is true
    console.log('Attempting to emit Done (should be blocked by isTimeout)');
    await adapter.emit(ExtractorEventType.DataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    console.log('onTimeout called - emitting progress');
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
