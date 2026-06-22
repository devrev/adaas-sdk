import { processExtractionTask } from '../../index';

processExtractionTask({
  // eslint-disable-next-line @typescript-eslint/require-await
  task: async () => {
    for (let i = 0; i < 10; i++) {
      console.log('no-timeout iteration', i);
    }

    return { status: 'success' };
  },
  // eslint-disable-next-line @typescript-eslint/require-await
  onTimeout: async () => {
    return { status: 'progress' };
  },
});
