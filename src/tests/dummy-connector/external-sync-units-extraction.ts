import {
  AirSyncDefaultItemTypes,
  ExternalSyncUnit,
  ExtractorEventType,
  processExtractionTask,
} from '../../index';

processExtractionTask({
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

    adapter.initializeRepos([
      {
        itemType: AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS,
      },
    ]);

    await adapter
      .getRepo(AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS)
      ?.push(dummyExternalSyncUnits);

    await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionError, {
      error: {
        message: 'Failed to extract external sync units. Lambda timeout.',
      },
    });
  },
});
