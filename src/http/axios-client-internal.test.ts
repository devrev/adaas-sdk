import { mockServer } from '../tests/jest.setup';
import { axiosClient } from './axios-client-internal';

jest.setTimeout(60000);

describe('Internal Axios Client', () => {
  it('should not retry on 200 response', async () => {
    await axiosClient.get(mockServer.baseUrl + '/test-endpoint');
    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(1);
  });

  it('should not retry on 400 response', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 400,
    });

    await expect(
      axiosClient.get(mockServer.baseUrl + '/test-endpoint')
    ).rejects.toThrow();

    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(1);
  });

  // TODO: This test is working as expected, but it takes too long to run. Not
  // sure if it is good idea to have it.
  //   it('should retry on 500 response', async () => {
  //     mockServer.setRoute({
  //       path: '/test-endpoint',
  //       method: 'GET',
  //       status: 200,
  //       retry: {
  //         failureCount: 4,
  //         errorStatus: 500,
  //         errorBody: { error: 'Internal Server Error' },
  //       },
  //     });

  //     await axiosClient.get(mockServer.baseUrl + '/test-endpoint');
  //     expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(5);
  //   });

  it('should retry 2 times on 500 response and then succeed third time when response is 200', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 2,
        errorStatus: 500,
        errorBody: { error: 'Internal Server Error' },
      },
    });

    await axiosClient.get(mockServer.baseUrl + '/test-endpoint');
    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(3);
  });

  it('should retry once after 3 seconds when response is 429 and Retry-After header is valid value', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 1,
        errorStatus: 429,
        headers: {
          'Retry-After': '3',
        },
      },
    });

    await axiosClient.get(mockServer.baseUrl + '/test-endpoint');
    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(2);
  });

  it('should retry once after 3 seconds and measure time between retries when response is 429 and Retry-After header is valid value', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 1,
        errorStatus: 429,
        headers: { 'Retry-After': '3' },
      },
    });

    const startTime = Date.now();
    await axiosClient.get(mockServer.baseUrl + '/test-endpoint');
    const endTime = Date.now();
    const duration = endTime - startTime;

    const expectedDuration = 3 * 1000;
    expect(duration).toBeGreaterThanOrEqual(expectedDuration);
    expect(duration).toBeLessThan(expectedDuration + 1000);
  });

  it('should retry when response is 429 and Retry-After header is lowercase', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 1,
        errorStatus: 429,
        headers: { 'retry-after': '3' },
      },
    });

    await axiosClient.get(mockServer.baseUrl + '/test-endpoint');
    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(2);
  });

  it('[edge] should not retry when response is 429 and there is no Retry-After header', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 1,
        errorStatus: 429,
      },
    });

    await expect(
      axiosClient.get(mockServer.baseUrl + '/test-endpoint')
    ).rejects.toThrow();

    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(1);
  });

  it('[edge] should retry when response is 429 and Retry-After header is 0', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 1,
        errorStatus: 429,
        headers: { 'Retry-After': '0' },
      },
    });

    await axiosClient.get(mockServer.baseUrl + '/test-endpoint');
    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(2);
  });

  it('[edge] should not retry when response is 429 and Retry-After header is negative value', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 1,
        errorStatus: 429,
        headers: { 'Retry-After': '-1' },
      },
    });

    await expect(
      axiosClient.get(mockServer.baseUrl + '/test-endpoint')
    ).rejects.toThrow();

    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(1);
  });

  it('[edge] should not retry when response is 429 and Retry-After header is invalid value', async () => {
    mockServer.setRoute({
      path: '/test-endpoint',
      method: 'GET',
      status: 200,
      retry: {
        failureCount: 1,
        errorStatus: 429,
        headers: { 'Retry-After': 'invalid' },
      },
    });

    await expect(
      axiosClient.get(mockServer.baseUrl + '/test-endpoint')
    ).rejects.toThrow();

    expect(mockServer.getRequestCount('GET', '/test-endpoint')).toBe(1);
  });
});
