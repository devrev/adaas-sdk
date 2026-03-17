import { AxiosError, AxiosHeaders } from 'axios';
import { isLocalUrl, isNonRetryableConnectionError } from './axios-client';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Helper to create a minimal AxiosError with a specific error code and optional URL.
 */
function createAxiosError({
  code,
  url,
  status,
}: {
  code?: string;
  url?: string;
  status?: number;
}): AxiosError {
  const error = new AxiosError(
    'Request failed',
    code,
    {
      url,
      headers: new AxiosHeaders(),
    } as any,
    undefined,
    status
      ? ({
          status,
          statusText: 'Error',
          headers: {},
          config: {} as any,
          data: {},
        } as any)
      : undefined
  );

  return error;
}

describe('isLocalUrl', () => {
  describe('should return true for local/private URLs', () => {
    it('localhost', () => {
      expect(isLocalUrl('http://localhost')).toBe(true);
    });

    it('localhost with port', () => {
      expect(isLocalUrl('http://localhost:8080')).toBe(true);
    });

    it('localhost with path', () => {
      expect(isLocalUrl('http://localhost:3000/api/v1/files/123')).toBe(true);
    });

    it('localhost HTTPS', () => {
      expect(isLocalUrl('https://localhost/file.pdf')).toBe(true);
    });

    it('0.0.0.0', () => {
      expect(isLocalUrl('http://0.0.0.0')).toBe(true);
    });

    it('0.0.0.0 with port', () => {
      expect(isLocalUrl('http://0.0.0.0:9090/files')).toBe(true);
    });

    it('127.0.0.1 (IPv4 loopback)', () => {
      expect(isLocalUrl('http://127.0.0.1')).toBe(true);
    });

    it('127.0.0.1 with port', () => {
      expect(isLocalUrl('http://127.0.0.1:3000')).toBe(true);
    });

    it('127.0.0.255 (other loopback address)', () => {
      expect(isLocalUrl('http://127.0.0.255')).toBe(true);
    });

    it('127.255.255.255 (end of loopback range)', () => {
      expect(isLocalUrl('http://127.255.255.255')).toBe(true);
    });

    it('[::1] (IPv6 loopback)', () => {
      expect(isLocalUrl('http://[::1]')).toBe(true);
    });

    it('[::1] with port', () => {
      expect(isLocalUrl('http://[::1]:8080/files')).toBe(true);
    });

    it('10.0.0.1 (private range)', () => {
      expect(isLocalUrl('http://10.0.0.1')).toBe(true);
    });

    it('10.255.255.255 (end of 10.x range)', () => {
      expect(isLocalUrl('http://10.255.255.255')).toBe(true);
    });

    it('10.0.0.5 with path', () => {
      expect(isLocalUrl('http://10.0.0.5/attachments/doc.pdf')).toBe(true);
    });

    it('192.168.1.1 (private range)', () => {
      expect(isLocalUrl('http://192.168.1.1')).toBe(true);
    });

    it('192.168.0.100 with port', () => {
      expect(isLocalUrl('http://192.168.0.100:8443/files')).toBe(true);
    });

    it('192.168.255.255 (end of 192.168.x range)', () => {
      expect(isLocalUrl('http://192.168.255.255')).toBe(true);
    });

    it('172.16.0.1 (start of private range)', () => {
      expect(isLocalUrl('http://172.16.0.1')).toBe(true);
    });

    it('172.31.255.255 (end of private range)', () => {
      expect(isLocalUrl('http://172.31.255.255')).toBe(true);
    });

    it('172.20.10.5 (middle of private range)', () => {
      expect(isLocalUrl('http://172.20.10.5/api/files')).toBe(true);
    });

    it('.local TLD', () => {
      expect(isLocalUrl('http://jira.company.local/files/123')).toBe(true);
    });

    it('.local TLD with port', () => {
      expect(isLocalUrl('http://myserver.local:8080')).toBe(true);
    });

    it('.internal TLD', () => {
      expect(isLocalUrl('http://api.internal/files')).toBe(true);
    });

    it('.internal TLD with subdomain', () => {
      expect(isLocalUrl('http://jira.corp.internal:9090/attachments')).toBe(
        true
      );
    });
  });

  describe('should return false for public/external URLs', () => {
    it('example.com', () => {
      expect(isLocalUrl('https://example.com')).toBe(false);
    });

    it('api.github.com', () => {
      expect(isLocalUrl('https://api.github.com/repos')).toBe(false);
    });

    it('jira.atlassian.net', () => {
      expect(isLocalUrl('https://jira.atlassian.net/rest/api/file')).toBe(
        false
      );
    });

    it('public IP address', () => {
      expect(isLocalUrl('http://8.8.8.8')).toBe(false);
    });

    it('public IP address 1.2.3.4', () => {
      expect(isLocalUrl('http://1.2.3.4/files')).toBe(false);
    });

    it('128.0.0.1 (not in loopback range)', () => {
      expect(isLocalUrl('http://128.0.0.1')).toBe(false);
    });

    it('192.169.1.1 (not in 192.168.x range)', () => {
      expect(isLocalUrl('http://192.169.1.1')).toBe(false);
    });

    it('172.15.0.1 (below private range)', () => {
      expect(isLocalUrl('http://172.15.0.1')).toBe(false);
    });

    it('172.32.0.1 (above private range)', () => {
      expect(isLocalUrl('http://172.32.0.1')).toBe(false);
    });

    it('11.0.0.1 (not in 10.x range)', () => {
      expect(isLocalUrl('http://11.0.0.1')).toBe(false);
    });

    it('hostname that contains "local" but is not .local TLD', () => {
      expect(isLocalUrl('https://localfiles.example.com/doc.pdf')).toBe(false);
    });

    it('hostname that contains "internal" but is not .internal TLD', () => {
      expect(isLocalUrl('https://internal-api.example.com/files')).toBe(false);
    });
  });

  describe('should return false for edge cases (fail open)', () => {
    it('undefined', () => {
      expect(isLocalUrl(undefined)).toBe(false);
    });

    it('empty string', () => {
      expect(isLocalUrl('')).toBe(false);
    });

    it('invalid URL', () => {
      expect(isLocalUrl('not-a-url')).toBe(false);
    });

    it('relative path', () => {
      expect(isLocalUrl('/api/files/123')).toBe(false);
    });
  });
});

describe('isNonRetryableConnectionError', () => {
  describe('should return true for non-retryable connection errors', () => {
    it('ECONNREFUSED', () => {
      const error = createAxiosError({ code: 'ECONNREFUSED' });
      expect(isNonRetryableConnectionError(error)).toBe(true);
    });

    it('ENOTFOUND', () => {
      const error = createAxiosError({ code: 'ENOTFOUND' });
      expect(isNonRetryableConnectionError(error)).toBe(true);
    });

    it('ENETUNREACH', () => {
      const error = createAxiosError({ code: 'ENETUNREACH' });
      expect(isNonRetryableConnectionError(error)).toBe(true);
    });

    it('EHOSTUNREACH', () => {
      const error = createAxiosError({ code: 'EHOSTUNREACH' });
      expect(isNonRetryableConnectionError(error)).toBe(true);
    });
  });

  describe('should return false for potentially transient errors', () => {
    it('ECONNABORTED (timeout)', () => {
      const error = createAxiosError({ code: 'ECONNABORTED' });
      expect(isNonRetryableConnectionError(error)).toBe(false);
    });

    it('ECONNRESET', () => {
      const error = createAxiosError({ code: 'ECONNRESET' });
      expect(isNonRetryableConnectionError(error)).toBe(false);
    });

    it('ETIMEDOUT', () => {
      const error = createAxiosError({ code: 'ETIMEDOUT' });
      expect(isNonRetryableConnectionError(error)).toBe(false);
    });

    it('ERR_CANCELED', () => {
      const error = createAxiosError({ code: 'ERR_CANCELED' });
      expect(isNonRetryableConnectionError(error)).toBe(false);
    });

    it('ERR_BAD_RESPONSE', () => {
      const error = createAxiosError({ code: 'ERR_BAD_RESPONSE' });
      expect(isNonRetryableConnectionError(error)).toBe(false);
    });
  });

  describe('should return false for edge cases', () => {
    it('no error code', () => {
      const error = createAxiosError({});
      expect(isNonRetryableConnectionError(error)).toBe(false);
    });

    it('HTTP error with status code (not a connection error)', () => {
      const error = createAxiosError({ status: 500 });
      expect(isNonRetryableConnectionError(error)).toBe(false);
    });
  });
});

describe('axiosClient retryCondition integration', () => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * We test the retry condition indirectly by importing the axiosClient and
   * verifying its behavior. Since we can't easily extract the retryCondition
   * callback, we test through the helpers which the retryCondition delegates to.
   *
   * The key invariant is:
   * - isLocalUrl(url) === true  => should NOT retry
   * - isNonRetryableConnectionError(error) === true  => should NOT retry
   * - Otherwise, delegate to the existing retry logic
   */

  it('should not retry ECONNREFUSED to a local URL', () => {
    const error = createAxiosError({
      code: 'ECONNREFUSED',
      url: 'http://localhost:8080/files',
    });

    // Both conditions match — should definitely not retry
    expect(isLocalUrl(error.config?.url)).toBe(true);
    expect(isNonRetryableConnectionError(error)).toBe(true);
  });

  it('should not retry ENOTFOUND to a .local TLD', () => {
    const error = createAxiosError({
      code: 'ENOTFOUND',
      url: 'http://jira.company.local/attachments/123',
    });

    expect(isLocalUrl(error.config?.url)).toBe(true);
    expect(isNonRetryableConnectionError(error)).toBe(true);
  });

  it('should not retry ECONNREFUSED to a public URL (caught by error code)', () => {
    const error = createAxiosError({
      code: 'ECONNREFUSED',
      url: 'https://api.example.com/files',
    });

    // URL looks public, but the error code is non-retryable
    expect(isLocalUrl(error.config?.url)).toBe(false);
    expect(isNonRetryableConnectionError(error)).toBe(true);
  });

  it('should not retry ENOTFOUND to a public-looking URL (caught by error code)', () => {
    const error = createAxiosError({
      code: 'ENOTFOUND',
      url: 'https://doesnotexist.example.com/files',
    });

    expect(isLocalUrl(error.config?.url)).toBe(false);
    expect(isNonRetryableConnectionError(error)).toBe(true);
  });

  it('should not retry any error to a private IP address', () => {
    const error = createAxiosError({
      code: 'ECONNRESET',
      url: 'http://192.168.1.50:3000/attachments',
    });

    // ECONNRESET is normally retryable, but the URL is local
    expect(isLocalUrl(error.config?.url)).toBe(true);
  });

  it('should allow retry for 500 error to a public URL', () => {
    const error = createAxiosError({
      code: 'ERR_BAD_RESPONSE',
      url: 'https://api.example.com/files',
      status: 500,
    });

    // Neither condition blocks retrying
    expect(isLocalUrl(error.config?.url)).toBe(false);
    expect(isNonRetryableConnectionError(error)).toBe(false);
  });

  it('should allow retry for ECONNRESET to a public URL', () => {
    const error = createAxiosError({
      code: 'ECONNRESET',
      url: 'https://api.example.com/files',
    });

    // ECONNRESET is transient, URL is public — should retry
    expect(isLocalUrl(error.config?.url)).toBe(false);
    expect(isNonRetryableConnectionError(error)).toBe(false);
  });

  it('should allow retry for ETIMEDOUT to a public URL', () => {
    const error = createAxiosError({
      code: 'ETIMEDOUT',
      url: 'https://api.example.com/files',
    });

    expect(isLocalUrl(error.config?.url)).toBe(false);
    expect(isNonRetryableConnectionError(error)).toBe(false);
  });
});
