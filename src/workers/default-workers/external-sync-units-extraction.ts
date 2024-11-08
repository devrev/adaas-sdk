import { ExternalSyncUnit, ExtractorEventType, processTask } from '../../index';

// Dummy data that originally would be fetched from an external source
const externalSyncUnits: ExternalSyncUnit[] = [
  {
    id: 'devrev',
    name: 'devrev',
    description: 'Demo external sync unit',
    item_count: 2,
    item_type: 'issues',
  },
];

processTask({
  task: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsDone, {
      external_sync_units: externalSyncUnits,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsError, {
      error: {
        message: 'Failed to extract external sync units. Lambda timeout.',
      },
    });
  },
});
