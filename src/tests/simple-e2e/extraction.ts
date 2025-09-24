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
        batchSize: 1000,
        timeout: 5 * 1000, // 5 seconds
        isLocalDevelopment: true,
      },
    });
  }
};

export default run;
