import { processExtractionTask } from '../../index';

/**
 * Test worker that triggers the SQS size limit (160KB = 80% of 200KB max).
 * Batch size 1 makes each item an artifact; artifact metadata is ~55 bytes,
 * so 3000 items (~165KB) exceed the threshold (~2857 needed).
 */
processExtractionTask({
  task: async ({ adapter }) => {
    // external_domain_metadata itemType doesn't require normalize
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
