import { AirdropEvent, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

const run = async (events: AirdropEvent[], workerPath: string) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath,
      initialDomainMapping,
      options: {
        isLocalDevelopment: true,
      },
    });
  }
};

export default run;
