import { ExtractorEventType, processTask } from '../../index';

const repos = [
  {
    itemType: 'external_domain_metadata',
  },
];

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);

    await adapter
      .getRepo('external_domain_metadata')
      ?.push([{ id: 'metadata-1' }]);

    await adapter.emit(ExtractorEventType.MetadataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.MetadataExtractionError, {
      error: { message: 'Failed to extract metadata. Lambda timeout.' },
    });
  },
});
