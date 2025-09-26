import { AirdropEvent, spawn } from '../../index';

const initialState = {};
const initialDomainMapping = {};
interface ExtractorState {}

const run = async (events: AirdropEvent[], workerPath: string) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath,
      initialDomainMapping,
      options: {
        timeout: 25 * 1000,
        isLocalDevelopment: true,
      },
    });
  }
};

export default run;
