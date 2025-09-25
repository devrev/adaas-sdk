/**
 * Axios client setup with retry capabilities using axios-retry.
 *
 * This module exports an Axios client instance (`axiosClient`) that is configured to automatically retry
 * failed requests under certain conditions.
 *
 * Retry Conditions:
 * 1. Network errors (where no response is received).
 * 2. Idempotent requests (defaults include GET, HEAD, OPTIONS, PUT).
 * 3. All 5xx server errors.
 *
 * Retry Strategy:
 * - A maximum of 5 retries are attempted.
 * - Exponential backoff delay is applied between retries, increasing with each retry attempt.
 *
 * Additional Features:
 * - When the maximum number of retry attempts is reached, sensitive headers (like authorization)
 *   are removed from error logs for security reasons.
 *
 * Exported:
 * - `axios`: Original axios instance for additional customizations or direct use.
 * - `axiosClient`: Configured axios instance with retry logic.
 */

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
      (axiosRetry.isNetworkOrIdempotentRequestError(error) &&
        error.response?.status !== 429) ||
      (error.response?.status ?? 0) >= 500
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
