import { ExtractorEventType, processTask } from '../../index';

// Simulate a network request with variable delays
const simulateNetworkRequest = (url: string, delay: number): Promise<any> => {
  return new Promise((resolve) => {
    console.log(`Starting network request to ${url}...`);
    setTimeout(() => {
      console.log(`Completed network request to ${url} after ${delay}ms`);
      resolve({ status: 200, data: `Response from ${url}` });
    }, delay);
  });
};

processTask({
  task: async ({ adapter }) => {
    console.log('Starting network requests simulation...');

    // Define request configurations
    const requestConfigs = [
      { url: '/api/users', delay: 3000 },
      { url: '/api/products', delay: 4000 },
      { url: '/api/orders', delay: 5000 },
      { url: '/api/analytics', delay: 6000 },
      { url: '/api/reports', delay: 4000 },
    ];

    try {
      // Execute requests sequentially - this will take approximately 22 seconds total
      for (const config of requestConfigs) {
        const response = await simulateNetworkRequest(config.url, config.delay);
        console.log('Network request completed:', response.data);
      }

      console.log('All network requests completed successfully');
      await adapter.emit(ExtractorEventType.ExtractionDataDone);
    } catch (error) {
      console.error('Network request failed:', error);
      await adapter.emit(ExtractorEventType.ExtractionDataDone);
    }
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionDataProgress);
  },
});
