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
 * Non-Retry Conditions:
 * 1. Requests to local/private URLs (localhost, private IPs, .local/.internal TLDs).
 * 2. Definitive connection failures (ECONNREFUSED, ENOTFOUND, ENETUNREACH, EHOSTUNREACH).
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
 * - `isLocalUrl`: Helper to check if a URL points to a local/private address.
 * - `isNonRetryableConnectionError`: Helper to check if an error indicates a definitively unreachable host.
 */

import axios, { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

/**
 * Error codes that indicate the target host is definitively unreachable.
 * These are distinct from transient errors (like ETIMEDOUT or ECONNRESET)
 * which could succeed on retry.
 */
const NON_RETRYABLE_ERROR_CODES = new Set([
  'ECONNREFUSED', // Nothing is listening at the target address
  'ENOTFOUND', // DNS resolution failed entirely
  'ENETUNREACH', // Network is unreachable
  'EHOSTUNREACH', // Host is unreachable
]);

/**
 * Checks whether a URL points to a local or private network address.
 *
 * This detects:
 * - `localhost` (any port)
 * - IPv4 loopback range (`127.x.x.x`)
 * - IPv6 loopback (`::1`, `[::1]`)
 * - Private IPv4 ranges (`10.x.x.x`, `172.16-31.x.x`, `192.168.x.x`)
 * - `0.0.0.0`
 * - `.local` TLD (mDNS / local domain)
 * - `.internal` TLD
 *
 * @param url - The URL string to check
 * @returns `true` if the URL targets a local/private address, `false` otherwise
 *   (including for undefined or unparseable URLs — fail open to let normal error handling take over)
 */
function isLocalUrl(url?: string): boolean {
  if (!url) {
    return false;
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();

    // localhost
    if (hostname === 'localhost') {
      return true;
    }

    // 0.0.0.0
    if (hostname === '0.0.0.0') {
      return true;
    }

    // IPv6 loopback — URL parser strips brackets, so ::1 is the hostname
    if (hostname === '::1' || hostname === '[::1]') {
      return true;
    }

    // .local and .internal TLDs
    if (hostname.endsWith('.local') || hostname.endsWith('.internal')) {
      return true;
    }

    // IPv4 checks: loopback and private ranges
    const ipv4Match = hostname.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/
    );
    if (ipv4Match) {
      const [, a, b] = ipv4Match.map(Number);

      // 127.x.x.x — loopback
      if (a === 127) {
        return true;
      }

      // 10.x.x.x — private
      if (a === 10) {
        return true;
      }

      // 192.168.x.x — private
      if (a === 192 && b === 168) {
        return true;
      }

      // 172.16.0.0 – 172.31.255.255 — private
      if (a === 172 && b >= 16 && b <= 31) {
        return true;
      }
    }

    return false;
  } catch {
    // URL parsing failed — fail open, let normal error handling take over
    return false;
  }
}

/**
 * Checks whether an Axios error indicates a definitively unreachable host.
 *
 * These error codes mean the target cannot be reached at all — retrying will
 * not help. This is distinct from transient errors like ETIMEDOUT or
 * ECONNRESET which could succeed on a subsequent attempt.
 *
 * Non-retryable codes:
 * - `ECONNREFUSED` — nothing is listening at the target address
 * - `ENOTFOUND` — DNS resolution failed entirely
 * - `ENETUNREACH` — network is unreachable
 * - `EHOSTUNREACH` — host is unreachable
 *
 * @param error - The Axios error to check
 * @returns `true` if the error indicates the host is definitively unreachable
 */
function isNonRetryableConnectionError(error: AxiosError): boolean {
  return !!error.code && NON_RETRYABLE_ERROR_CODES.has(error.code);
}

const axiosClient = axios.create();

axiosRetry(axiosClient, {
  retries: 5,
  retryDelay: (retryCount, error) => {
    // exponential backoff algorithm: 1 * 2 ^ retryCount * 1000ms
    const delay = axiosRetry.exponentialDelay(retryCount, error, 1000);

    console.warn(
      `Request to ${error.config?.url} failed with response status code ${
        error.response?.status
      }. Method ${
        error.config?.method
      }. Retry count: ${retryCount}. Retrying in ${Math.round(delay / 1000)}s.`
    );

    return delay;
  },
  retryCondition: (error: AxiosError) => {
    // Never retry requests to local/private URLs — they will never succeed
    // from the cloud environment.
    if (isLocalUrl(error.config?.url)) {
      console.warn(
        `Request to ${error.config?.url} failed with ${
          error.code ?? 'unknown error'
        }. ` +
          `Not retrying because the URL points to a local or private address.`
      );
      return false;
    }

    // Never retry definitive connection failures — the host is unreachable,
    // and retrying with exponential backoff will only waste time.
    if (isNonRetryableConnectionError(error)) {
      console.warn(
        `Request to ${error.config?.url} failed with ${error.code}. ` +
          `Not retrying because the target host appears to be unreachable.`
      );
      return false;
    }

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

export { axios, axiosClient, isLocalUrl, isNonRetryableConnectionError };
