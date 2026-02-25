import { AirdropEvent, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

/**
 * Run function for double-timeout tests.
 * Uses batch size of 1 to create many artifacts (triggering size limit),
 * combined with a short timeout to also trigger the real timeout message.
 * This creates a race condition where both paths try to call onTimeout.
 */
const run = async (events: AirdropEvent[], workerPath: string) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath,
      initialDomainMapping,
      options: {
        batchSize: 1, // Batch size of 1 to generate many artifacts
        timeout: 3 * 1000, // 3 second timeout to trigger WorkerMessageExit
        isLocalDevelopment: true,
      },
    });
  }
};

export default run;
