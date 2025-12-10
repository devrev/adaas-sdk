import { ExternalSyncUnit, ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    const dummyExternalSyncUnits: ExternalSyncUnit[] = [
      {
        id: '1',
        name: 'Dummy External Sync Unit',
        description: 'This is a dummy external sync unit',
        item_count: 10,
        item_type: 'dummy',
      },
    ];

    await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone, {
      external_sync_units: dummyExternalSyncUnits,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionError, {
      error: {
        message: 'Failed to extract external sync units. Lambda timeout.',
      },
    });
  },
});
