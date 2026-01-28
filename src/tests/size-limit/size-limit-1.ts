import { ExtractorEventType, processTask } from '../../index';

/**
 * Test worker that generates items to trigger the SQS size limit.
 *
 * The size limit is 160KB (80% of 200KB max).
 * With batch size 1, each item creates 1 artifact.
 * Each artifact metadata is ~55 bytes (id, item_type, item_count).
 * We need ~2857 artifacts to reach 160KB, so generating 3000 items.
 */
processTask({
  task: async ({ adapter }) => {
    console.log('[SIZE_LIMIT_TEST] Starting size limit test...');

    // Initialize repos first - this is required before using getRepo
    // Using external_domain_metadata itemType which doesn't require normalize
    adapter.initializeRepos([
      {
        itemType: 'external_domain_metadata',
      },
    ]);

    const repo = adapter.getRepo('external_domain_metadata');
    if (!repo) {
      console.error('[SIZE_LIMIT_TEST] Repo not found after init');
      await adapter.emit(ExtractorEventType.DataExtractionDone);
      return;
    }

    // Generate 3000 items with batch size 1 = 3000 artifacts
    // Each artifact metadata is ~55 bytes (id, item_type, item_count)
    // 3000 * 55 = 165KB > 160KB threshold
    const items = [];
    for (let i = 0; i < 3000; i++) {
      items.push({
        id: `item-${i}`,
        name: `Item ${i}`,
        data: {
          value: i,
        },
      });
    }

    console.log(
      `[SIZE_LIMIT_TEST] Pushing ${items.length} items (batch size 1) to trigger size limit...`
    );

    // Push items - this should trigger the size limit during upload
    await repo.push(items);

    // If we get here without size limit triggering, emit done
    if (!adapter.isTimeout) {
      console.log(
        '[SIZE_LIMIT_TEST] Size limit was NOT triggered, emitting done'
      );
      await adapter.emit(ExtractorEventType.DataExtractionDone);
    } else {
      console.log(
        '[SIZE_LIMIT_TEST] Size limit was triggered during task, onTimeout will be called'
      );
    }
  },
  onTimeout: async ({ adapter }) => {
    console.log('[SIZE_LIMIT_TEST] onTimeout called - emitting progress');
    await adapter.emit(ExtractorEventType.DataExtractionProgress);
  },
});
