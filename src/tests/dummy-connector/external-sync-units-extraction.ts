import {
  AirSyncDefaultItemTypes,
  ExternalSyncUnit,
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
        overridenOptions: { batchSize: 25000, skipConfirmation: true },
      },
    ]);

    await adapter
      .getRepo(AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS)
      ?.push(dummyExternalSyncUnits);

    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return {
      status: 'error',
      error: {
        message: 'Failed to extract external sync units. Lambda timeout.',
      },
    };
  },
});
