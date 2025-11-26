import { ExtractorEventType, processTask } from '../../../index';

const repos = [
  {
    itemType: 'external_domain_metadata',
  },
];

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);

    const externalDomainMetadata = {};

    await adapter
      .getRepo('external_domain_metadata')
      ?.push([externalDomainMetadata]);

    await adapter.emit(ExtractorEventType.ExtractionMetadataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
      error: { message: 'Failed to extract metadata. Lambda timeout.' },
    });
  },
});
