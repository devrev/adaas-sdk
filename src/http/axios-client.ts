import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const axiosClient = axios.create();

// Exponential backoff algorithm: Retry 3 times and there will be a delay of more than 1 * no. of retries second + random number of milliseconds between each retry.
axiosRetry(axiosClient, {
  retries: 3,
  retryDelay: (retryCount, error) => {
    console.log(`Retry attempt: ${retryCount} of ${error.config?.url}.`);
    return axiosRetry.exponentialDelay(retryCount, error, 1000);
  },
  retryCondition: (error: AxiosError) => {
    if (
      error.response?.status &&
      error.response?.status >= 500 &&
      error.response?.status <= 599
    ) {
      return true;
    } else if (error.response?.status === 429) {
      console.log(
        'Rate limit exceeded. Delay: ' + error.response.headers['retry-after']
      );
      return false;
    } else {
      return false;
    }
  },
  onMaxRetryTimesExceeded(error: AxiosError, retryCount) {
    console.log(`Max retries attempted: ${retryCount}`);
    delete error.config?.headers.Authorization;
    delete error.request._header;
  },
});

export { axios, axiosClient };
