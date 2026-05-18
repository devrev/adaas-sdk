import path from 'path';
import { AirSyncEvent, EventType, spawn } from '../../index';

interface ExtractorState {
  [key: string]: unknown;
}

const initialState = {};
const initialDomainMapping = {};

/**
 * Run function for attachment size limit tests.
 * Uses batch size of 1 to create many artifacts.
 * With 3000 items and batch size 1, we get 3000 artifacts.
 * Each artifact metadata is ~55 bytes, so 3000 * 55 = 165KB > 160KB threshold.
 */
const run = async (events: AirSyncEvent[], workerPath: string) => {
  const baseWorkerPath = path.dirname(workerPath);
  const workerFileName = '/' + path.basename(workerPath);

  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      baseWorkerPath,
      initialDomainMapping,
      options: {
        batchSize: 1, // Batch size of 1 to generate many artifacts
        isLocalDevelopment: true,
        workerPathOverrides: {
          [event.payload.event_type as EventType]: workerFileName,
        },
      },
    });
  }
};

export default run;
