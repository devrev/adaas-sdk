import { AirdropEvent, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

/**
 * Run function for size limit tests.
 * Uses batch size of 1 to create many artifacts.
 * With 3000 items and batch size 1, we get 3000 artifacts.
 * Each artifact metadata is ~55 bytes, so 3000 * 55 = 165KB > 160KB threshold.
 */
const runSizeLimitTest = async (events: AirdropEvent[], workerPath: string) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath,
      initialDomainMapping,
      options: {
        batchSize: 1, // Batch size of 1 to generate many artifacts
        isLocalDevelopment: true,
      },
    });
  }
};

export default runSizeLimitTest;
