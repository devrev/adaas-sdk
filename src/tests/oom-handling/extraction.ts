import { AirdropEvent, spawn } from '../../index';

const initialState = {};
const initialDomainMapping = {};
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExtractorState {}

/**
 * Run extraction with OOM-specific options.
 * Uses a very small memory limit to trigger OOM quickly.
 */
const run = async (
  events: AirdropEvent[],
  workerPath: string,
  options?: {
    enableMemoryLimits?: boolean;
    testMemoryLimitMb?: number;
  }
) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath,
      initialDomainMapping,
      options: {
        batchSize: 1000,
        timeout: 60 * 1000, // 60 seconds - enough time for OOM to occur
        isLocalDevelopment: true,
        enableMemoryLimits: options?.enableMemoryLimits ?? true,
        // Use a small memory limit for testing (64MB) to trigger OOM quickly
        testMemoryLimitMb: options?.testMemoryLimitMb ?? 64,
      },
    });
  }
};

export default run;

