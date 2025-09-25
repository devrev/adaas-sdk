import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const axiosClient = axios.create();

axiosRetry(axiosClient, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    // If the response status is 429, retry after the time specified in the Retry-After header
    if (error.response?.status === 429) {
      const retryAfter =
        error.response?.headers?.['retry-after'] ||
        error.response?.headers?.['Retry-After'];

      // Since DevRev API returns the retry-after header in seconds and axios-retry expects milliseconds, we need to convert it to milliseconds
      const delay = parseInt(retryAfter, 10) * 1000;
      const delayInSeconds = Math.round(delay / 1000);

      console.warn(
        `Retrying ${error.config?.method} request to ${error.config?.url} in ${delayInSeconds}s due to 429 Too Many Requests.`
      );

      return delay;
    }

    // Default exponential backoff algorithm: 1 * 2 ^ retryCount * 1000ms
    // This will retry requests after 2, 4, 8, 16 and 32 seconds
    const delay = axiosRetry.exponentialDelay(retryCount, error, 1000);
    const delayInSeconds = Math.round(delay / 1000);

    console.warn(
      `Retrying ${error.config?.method} request to ${error.config?.url} in ${delayInSeconds}s due to ${error.response?.status} error.`
    );

    return delay;
  },
  retryCondition: (error: AxiosError) => {
    const retryAfter =
      error.response?.headers?.['retry-after'] ||
      error.response?.headers?.['Retry-After'];

    // 5xx errors
    if (error.response?.status && error.response.status >= 500) {
      return true;
    }

    // 429 errors when retry-after header is present
    else if (
      error.response?.status &&
      error.response.status === 429 &&
      retryAfter &&
      !isNaN(Number(retryAfter)) &&
      Number(retryAfter) >= 0
    ) {
      return true;
    }

    // all other errors
    else {
      return false;
    }
  },
  onMaxRetryTimesExceeded(error: AxiosError) {
    delete error.config?.headers?.authorization;
    delete error.config?.headers?.Authorization;
    delete error.request?._header;

    console.error(
      `Request to ${error.config?.url} failed after max retries. Error`,
      error
    );
  },
});
export { axiosClient };
