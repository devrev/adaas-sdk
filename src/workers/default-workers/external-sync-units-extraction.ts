import {
  ExternalSyncUnit,
  ExtractorEventTypeV2,
  processTask,
} from '../../index';

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
    await adapter.emit(ExtractorEventTypeV2.ExtractionExternalSyncUnitsDone, {
      external_sync_units: externalSyncUnits,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventTypeV2.ExtractionExternalSyncUnitsError, {
      error: {
        message: 'Failed to extract external sync units. Lambda timeout.',
      },
    });
  },
});
