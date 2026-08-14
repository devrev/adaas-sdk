import { processExtractionTask } from '../../index';

processExtractionTask({
  // eslint-disable-next-line @typescript-eslint/require-await
  task: async () => {
    console.log('Some cleanup logic executed.');
    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return {
      status: 'error',
      error: {
        message: 'Failed to execute cleanup logic. Lambda timeout.',
      },
    };
  },
});
