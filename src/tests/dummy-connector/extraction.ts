import path from 'path';
import { AirdropEvent, EventType, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

const run = async (events: AirdropEvent[], workerPath: string) => {
  const baseWorkerPath = path.dirname(workerPath);
  const workerFileName = '/' + path.basename(workerPath);

  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      baseWorkerPath,
      initialDomainMapping,
      options: {
        isLocalDevelopment: true,
        workerPathOverrides: {
          [event.payload.event_type as EventType]: workerFileName,
        },
      },
    });
  }
};

export default run;
