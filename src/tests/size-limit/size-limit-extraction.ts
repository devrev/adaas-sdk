import { AirdropEvent, spawn } from '../../index';

const initialState = {};
const initialDomainMapping = {};
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExtractorState {}

/**
 * Run function for size limit tests.
 * Uses batch size of 1 to trigger an upload for each item.
 * This allows us to hit the size limit faster since each upload adds ~80 bytes
 * of artifact metadata to the cumulative size.
 * To hit 160KB threshold, we need ~2000 uploads.
 */
const runSizeLimitTest = async (events: AirdropEvent[], workerPath: string) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath,
      initialDomainMapping,
      options: {
        batchSize: 1, // Batch size of 1 to trigger upload for each item
        timeout: 60 * 1000, // 60 seconds - enough time for many uploads
        isLocalDevelopment: true,
      },
    });
  }
};

export default runSizeLimitTest;
