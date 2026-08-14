import { ItemInputType, processExtractionTask } from '../../index';

const repos = [
  {
    itemType: 'external_domain_metadata',
  },
];

processExtractionTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);

    const externalDomainMetadata = {};

    await adapter
      .getRepo('external_domain_metadata')
      ?.push([externalDomainMetadata]);

    adapter.preExtractionItemCounts = [
      {
        record_type: 'tickets',
        count: 0,
        model_input_type: ItemInputType.MAIN,
      },
      {
        record_type: 'customers',
        count: 1200,
        model_input_type: ItemInputType.USERS,
      },
    ];

    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return {
      status: 'error',
      error: { message: 'Failed to extract metadata. Lambda timeout.' },
    };
  },
});
