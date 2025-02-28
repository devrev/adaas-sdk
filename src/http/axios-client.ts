import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const axiosClient = axios.create();

axiosRetry(axiosClient, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    // exponential backoff algorithm: 1 * 2 ^ retryCount * 1000ms
    const delay = axiosRetry.exponentialDelay(retryCount, error, 1000);

    console.warn(
      `Request to ${error.config?.url} failed with response status code ${error.response?.status}. Method ${error.config?.method}. Retry count: ${retryCount}. Retrying in ${Math.round(delay / 1000)}s.`
    );

    return delay;
  },
  retryCondition: (error: AxiosError) => {
    return (
      axiosRetry.isNetworkOrIdempotentRequestError(error) &&
      error.response?.status !== 429
    );
  },
  onMaxRetryTimesExceeded(error: AxiosError) {
    delete error.config?.headers?.authorization;
    delete error.config?.headers?.Authorization;
    delete error.request._header;
    console.warn('Max retry times exceeded. Error', error);
  },
});

export { axios, axiosClient };
