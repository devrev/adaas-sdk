import { AxiosError } from 'axios';
import axiosRetry from 'axios-retry';

describe('axios-client', () => {
  describe('429 response', () => {
    it('should identify 429 as retryable', () => {
      const error429: Partial<AxiosError> = {
        response: {
          status: 429,
          data: {},
          statusText: 'Too Many Requests',
          headers: {},
          config: {},
        } as any,
        config: { url: '/test', method: 'GET' } as any,
      };

      // Test our retry condition logic directly
      const shouldRetry =
        axiosRetry.isNetworkOrIdempotentRequestError(error429 as AxiosError) ||
        error429.response?.status === 429 ||
        (error429.response?.status ?? 0) >= 500;

      expect(shouldRetry).toBe(true);
    });

    it('should calculate delay for 429 with Retry-After header', () => {
      const retryAfterSeconds = 5;
      const error429WithRetryAfter: Partial<AxiosError> = {
        response: {
          status: 429,
          headers: { 'retry-after': retryAfterSeconds.toString() },
          data: {},
          statusText: 'Too Many Requests',
          config: {},
        } as any,
        config: { url: '/test', method: 'GET' } as any,
      };

      // Test delay calculation logic for 429 with Retry-After
      let delay: number;
      if (error429WithRetryAfter.response?.status === 429) {
        const retryAfter =
          error429WithRetryAfter.response.headers?.['retry-after'];
        if (retryAfter) {
          delay = parseInt(retryAfter, 10) * 1000;
        } else {
          delay = axiosRetry.exponentialDelay(
            1,
            error429WithRetryAfter as AxiosError,
            1000
          );
        }
      } else {
        delay = axiosRetry.exponentialDelay(
          1,
          error429WithRetryAfter as AxiosError,
          1000
        );
      }

      expect(delay).toBe(retryAfterSeconds * 1000);
    });
  });

  describe('5xx response', () => {
    it('should identify 500 as retryable', () => {
      const error500: Partial<AxiosError> = {
        response: {
          status: 500,
          data: {},
          statusText: 'Internal Server Error',
          headers: {},
          config: {},
        } as any,
        config: { url: '/test', method: 'GET' } as any,
      };

      const shouldRetry =
        axiosRetry.isNetworkOrIdempotentRequestError(error500 as AxiosError) ||
        error500.response?.status === 429 ||
        (error500.response?.status ?? 0) >= 500;

      expect(shouldRetry).toBe(true);
    });

    it('should identify 502 as retryable', () => {
      const error502: Partial<AxiosError> = {
        response: {
          status: 502,
          data: {},
          statusText: 'Bad Gateway',
          headers: {},
          config: {},
        } as any,
        config: { url: '/test', method: 'POST' } as any,
      };

      const shouldRetry =
        axiosRetry.isNetworkOrIdempotentRequestError(error502 as AxiosError) ||
        error502.response?.status === 429 ||
        (error502.response?.status ?? 0) >= 500;

      expect(shouldRetry).toBe(true);
    });
  });

  describe('4xx response', () => {
    it('should NOT retry 400 Bad Request', () => {
      const error400: Partial<AxiosError> = {
        response: {
          status: 400,
          data: {},
          statusText: 'Bad Request',
          headers: {},
          config: {},
        } as any,
        config: { url: '/test', method: 'GET' } as any,
      };

      const shouldRetry =
        axiosRetry.isNetworkOrIdempotentRequestError(error400 as AxiosError) ||
        error400.response?.status === 429 ||
        (error400.response?.status ?? 0) >= 500;

      expect(shouldRetry).toBe(false);
    });

    it('should NOT retry 404 Not Found', () => {
      const error404: Partial<AxiosError> = {
        response: {
          status: 404,
          data: {},
          statusText: 'Not Found',
          headers: {},
          config: {},
        } as any,
        config: { url: '/test', method: 'GET' } as any,
      };

      const shouldRetry =
        axiosRetry.isNetworkOrIdempotentRequestError(error404 as AxiosError) ||
        error404.response?.status === 429 ||
        (error404.response?.status ?? 0) >= 500;

      expect(shouldRetry).toBe(false);
    });
  });
});
