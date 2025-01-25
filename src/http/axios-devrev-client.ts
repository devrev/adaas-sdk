import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const axiosDevRevClient = axios.create();

axiosRetry(axiosDevRevClient, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    console.warn(
      'Retry attempt: ' + retryCount + 'to url: ' + error.config?.url + '.'
    );
    if (error.response) {
      const retry_after = error.response?.headers['retry-after'];
      if (retry_after) {
        return retry_after;
      }
    }
    // Exponential backoff algorithm: 1 * 2 ^ retryCount * 1000ms
    return axiosRetry.exponentialDelay(retryCount, error, 1000);
  },
  retryCondition: (error: AxiosError) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) ||
      error.response?.status === 429
    );
  },
  onMaxRetryTimesExceeded(error: AxiosError, retryCount) {
    console.log(`Max retries attempted: ${retryCount}`);
    delete error.config?.headers.Authorization;
    delete error.request._header;
  },
});

export { axios, axiosDevRevClient };
