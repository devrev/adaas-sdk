import path from 'path';
import { AirSyncEvent, EventType, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

const run = async (events: AirSyncEvent[], workerPath?: string) => {
  for (const event of events) {
    const overrides =
      workerPath != null
        ? {
            workerPathOverrides: {
              [event.payload.event_type as EventType]:
                '/' + path.basename(workerPath),
            },
          }
        : {};

    await spawn<ExtractorState>({
      event,
      initialState,
      baseWorkerPath: workerPath != null ? path.dirname(workerPath) : undefined,
      initialDomainMapping,
      options: {
        isLocalDevelopment: true,
        ...overrides,
      },
    });
  }
};

export default run;
