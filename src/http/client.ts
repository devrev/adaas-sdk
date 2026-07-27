import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

const axiosClient = axios.create({
  timeout: 30 * 1000,
});

axiosRetry(axiosClient, {
  retries: 5,
  shouldResetTimeout: true,
  retryDelay: (retryCount, error) => {
    let delay;
    if (error.response?.status === 429) {
      const retryAfter =
        error.response?.headers?.['retry-after'] ||
        error.response?.headers?.['Retry-After'];

      delay = parseInt(retryAfter, 10) * 1000;
    } else {
      delay = axiosRetry.exponentialDelay(retryCount, error, 1000);
    }

    const requestId =
      error.config?.headers?.['x-request-id'] ||
      error.config?.headers?.['X-Request-ID'];
    const delayInSeconds = Math.round(delay / 1000);

    console.warn(
      `Retrying request to ${error.config?.url} in ${delayInSeconds}s due to ${
        error.response?.status ?? 'unknown'
      } error.`,
      {
        method: error.config?.method,
        ...(retryCount && { retryCount }),
        ...(requestId && { requestId }),
      }
    );

    return delay;
  },
  retryCondition: (error: AxiosError) => {
    const retryAfter =
      error.response?.headers?.['retry-after'] ||
      error.response?.headers?.['Retry-After'];

    if (error.response?.status && error.response.status >= 500) {
      return true;
    }

    // 429 only when a valid non-negative Retry-After header is present
    else if (
      error.response?.status &&
      error.response.status === 429 &&
      retryAfter &&
      !isNaN(Number(retryAfter)) &&
      Number(retryAfter) >= 0
    ) {
      return true;
    }

    // Network errors for idempotent requests; 429 already handled above
    else if (
      axiosRetry.isNetworkOrIdempotentRequestError(error) &&
      error.response?.status !== 429
    ) {
      return true;
    }

    // axios-retry excludes ECONNABORTED (client-side timeout only, never a
    // server response) from isNetworkError, so handle it here separately.
    else if (error.code === 'ECONNABORTED') {
      return true;
    } else {
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
