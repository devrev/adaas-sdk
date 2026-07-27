import { AirSyncEvent, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

const run = async (events: AirSyncEvent[], workerPath: string) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      initialDomainMapping,
      baseWorkerPath: '',
      options: {
        batchSize: 1000,
        timeout: 5 * 1000, // 5 seconds
        isLocalDevelopment: true,
        workerPathOverrides: workerPath
          ? { [event.payload.event_type]: workerPath }
          : undefined,
      },
    });
  }
};

export default run;
