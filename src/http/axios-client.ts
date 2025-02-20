import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const axiosClient = axios.create();

axiosRetry(axiosClient, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    console.warn(
      'Retry attempt: ' + retryCount + 'to url: ' + error.config?.url + '.'
    );

    // Exponential backoff algorithm: 1 * 2 ^ retryCount * 1000ms
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
