import { AirdropEvent, spawn, WorkerAdapterOptions } from '../../index';

const initialState = {};
const initialDomainMapping = {};
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface ExtractorState {}

/**
 * Helper function to run OOM test workers
 * 
 * @param events - Array of events to process
 * @param workerPath - Path to the worker file
 * @param customOptions - Custom worker options (e.g., memory limits, monitoring config)
 */
const run = async (
  events: AirdropEvent[],
  workerPath: string,
  customOptions?: Partial<WorkerAdapterOptions>
) => {
  for (const event of events) {
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath,
      initialDomainMapping,
      options: {
        batchSize: 1000,
        timeout: 30 * 1000, // 30 seconds
        isLocalDevelopment: true,
        ...customOptions,
      },
    });
  }
};

export { run };
export default run;

