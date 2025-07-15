import { ExtractorEventType, processTask } from '../../index';

processTask({
  task: async ({ adapter }) => {
    console.log('Starting intensive computation...');
    let result = 0;

    // Intensive loop - calibrated to exceed 10 seconds but show progress
    for (let i = 1; i <= 30000; i++) {
      for (let num = 2; num <= 2000; num++) {
        let isPrime = true;
        for (let divisor = 2; divisor <= Math.sqrt(num); divisor++) {
          if (num % divisor === 0) {
            isPrime = false;
            break;
          }
        }

        if (isPrime) {
          for (let j = 0; j < 200; j++) {
            result +=
              Math.sin(num * j) * Math.cos(i * j) * Math.sqrt(num + i + j);
            result = Math.abs(result) % 1000000;
          }
        }
      }

      // Log every 500 iterations to see progress before timeout
      if (i % 500 === 0) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        console.log(`timeout-3b iteration ${i}, result: ${result}`);
      }
    }

    console.log(`Final computation result: ${result}`);
    await adapter.emit(ExtractorEventType.ExtractionDataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});
