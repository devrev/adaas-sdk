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
        isLocalDevelopment: true,
        workerPathOverrides: workerPath
          ? { [event.payload.event_type]: workerPath }
          : undefined,
      },
    });
  }
};

export default run;
