import { processTask } from '../../index';

processTask({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  task: async ({ adapter }) => {
    await new Promise((resolve) =>
      setTimeout(() => {
        console.log('task should not be called.');
        resolve(true);
      }, 1000)
    );
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  onTimeout: async ({ adapter }) => {
    await new Promise((resolve) =>
      setTimeout(() => {
        console.log('onTimeout should not be called.');
        resolve(true);
      }, 1000)
    );
  },
});
