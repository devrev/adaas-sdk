import { ExtractorEventType, processTask } from '../../index';

/**
 * Test worker that generates many items to trigger the SQS size limit.
 *
 * The size limit is 160KB (80% of 200KB max).
 * Each artifact metadata object is ~80 bytes when serialized.
 * With batch size of 1, each item triggers one upload.
 * To hit 160KB, we need ~2000 uploads (160000 / 80 = 2000).
 * We generate 2500 items to ensure we hit the limit.
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

    // Generate 2500 items - with batch size of 1, this creates 2500 uploads
    // Each artifact metadata is ~80 bytes, so 2500 * 80 = 200KB > 160KB threshold
    const items = [];
    for (let i = 0; i < 2500; i++) {
      items.push({
        id: `item-${i}`,
        data: { value: i },
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
