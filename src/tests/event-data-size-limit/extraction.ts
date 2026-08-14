import { AirSyncEvent, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

/**
 * Run function for size limit tests. Batch size 1 makes each item an artifact
 * (~55 bytes of metadata), so 3000 items (~165KB) exceed the 160KB threshold.
 */
const run = async (events: AirSyncEvent[], workerPath: string) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      initialDomainMapping,
      baseWorkerPath: '',
      options: {
        batchSize: 1,
        isLocalDevelopment: true,
        workerPathOverrides: workerPath
          ? { [event.payload.event_type]: workerPath }
          : undefined,
      },
    });
  }
};

export default run;
