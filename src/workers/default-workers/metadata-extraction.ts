import { ExtractorEventTypeV2, processTask } from '../../index';

import externalDomainMetadata from '../dummy-extractor/external_domain_metadata.json';

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
      ?.push([externalDomainMetadata]);
    await adapter.emit(ExtractorEventTypeV2.ExtractionMetadataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventTypeV2.ExtractionMetadataError, {
      error: { message: 'Failed to extract metadata. Lambda timeout.' },
    });
  },
});
