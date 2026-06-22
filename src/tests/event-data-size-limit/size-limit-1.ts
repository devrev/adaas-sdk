import { processExtractionTask } from '../../index';

/**
 * Test worker that generates items to trigger the SQS size limit.
 *
 * The size limit is 160KB (80% of 200KB max).
 * With batch size 1, each item creates 1 artifact.
 * Each artifact metadata is ~55 bytes (id, item_type, item_count).
 * We need ~2857 artifacts to reach 160KB, so generating 3000 items.
 */
processExtractionTask({
  task: async ({ adapter }) => {
    // Using external_domain_metadata itemType which doesn't require normalize
    adapter.initializeRepos([
      {
        itemType: 'external_domain_metadata',
      },
    ]);

    const repo = adapter.getRepo('external_domain_metadata');
    if (!repo) {
      console.error('Repo not found after init');
      return {
        status: 'error',
        error: { message: 'Repo not found after init!' },
      };
    }

    // Generate 3000 items with batch size 1 = 3000 artifacts
    // Each artifact metadata is ~55 bytes (id, item_type, item_count)
    // 3000 * 55 = 165KB > 160KB threshold
    for (let i = 0; i < 3000; i++) {
      await repo.push([
        {
          id: `item-${i}`,
          name: `Item ${i}`,
          data: {
            value: i,
          },
        },
      ]);

      if (adapter.isTimeout) {
        return { status: 'progress' };
      }
    }

    console.log('Size limit was NOT triggered, emitting done');
    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    console.log('onTimeout called - emitting progress');
    return { status: 'progress' };
  },
});
