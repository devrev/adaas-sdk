import { processTask } from '../../index';

processTask({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/require-await
  task: async ({ adapter }) => {
    console.log('task should not be called.');
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/require-await
  onTimeout: async ({ adapter }) => {
    console.log('onTimeout should not be called.');
  },
});
