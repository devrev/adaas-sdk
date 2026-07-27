import { processExtractionTask } from '../../index';

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
