import { processExtractionTask } from '../../index';

processExtractionTask({
  // eslint-disable-next-line @typescript-eslint/require-await
  task: async () => {
    console.log('task should not be called.');
    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    console.log('onTimeout should not be called.');
    return { status: 'success' };
  },
});
