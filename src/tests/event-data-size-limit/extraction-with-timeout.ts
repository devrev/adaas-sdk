import { AirdropEvent, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

/**
 * Run function for double-timeout tests.
 * Uses batch size of 1 to create many artifacts (triggering size limit),
 * combined with a timeout to also trigger the real timeout message.
 * This creates a race condition where both paths try to call onTimeout.
 *
 * The timeout must be long enough for the push to complete (3000 HTTP
 * requests with batch size 1 can take 5-10s on slow CI runners), but
 * shorter than the worker's post-push sleep so that the soft timeout
 * fires while the worker is sleeping.
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
        timeout: 15 * 1000, // 15 second timeout to trigger WorkerMessageExit (must fire after push completes)
        isLocalDevelopment: true,
      },
    });
  }
};

export default run;
