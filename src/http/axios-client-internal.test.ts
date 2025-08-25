import MockAdapter from 'axios-mock-adapter';

import { axiosClient } from './axios-client-internal';

describe('Internal Axios Client', () => {
  let mockAdapter: MockAdapter;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockAdapter = new MockAdapter(axiosClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    mockAdapter.restore();
  });

  it('should not retry on 200 response', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const responseData = { id: 1, title: 'test title' };
    mockAdapter.onGet(testUrl).reply(200, responseData);

    // Act
    await axiosClient.get(testUrl);

    // Assert
    expect(mockAdapter.history.get).toHaveLength(1);
  });

  it('should not retry when response is 400', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Bad Request' };
    mockAdapter.onGet(testUrl).reply(400, errorData);

    // Act
    await expect(axiosClient.get(testUrl)).rejects.toMatchObject({
      response: { status: 400 },
    });

    // Assert
    expect(mockAdapter.history.get).toHaveLength(1);
  });

  // TODO: This test is working as expected, but it takes too long to run. Not
  // sure if it is good idea to have it.
  // it('should retry on 500 response', async () => {
  //   // Arrange
  //   const testUrl = '/test-endpoint';
  //   mockAdapter.onGet(testUrl).reply(500);

  //   // Act & Assert
  //   await expect(axiosClient.get(testUrl)).rejects.toMatchObject({
  //     response: { status: 500 },
  //   });

  //   // Assert
  //   expect(mockAdapter.history.get).toHaveLength(6);
  // }, 100000);

  it('should retry 2 times when response is 500 and then succeed third time when response is 200', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const successData = { message: 'success after 2 retries' };
    mockAdapter
      .onGet(testUrl)
      .replyOnce(500)
      .onGet(testUrl)
      .replyOnce(500)
      .onGet(testUrl)
      .reply(200, successData);

    // Act
    const response = await axiosClient.get(testUrl);

    // Assert
    expect(response.status).toBe(200);
    expect(response.data).toEqual(successData);
    expect(mockAdapter.history.get).toHaveLength(3); // 1 initial + 2 retries
  }, 10000); // Allow time for 2 retries

  it('should retry once after 2 seconds when response is 429 and Retry-After header is valid value', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Too Many Requests' };
    const successData = { message: 'success after rate limit retry' };

    mockAdapter
      .onGet(testUrl)
      .replyOnce(429, errorData, {
        'Retry-After': '2',
      })
      .onGet(testUrl)
      .reply(200, successData);

    // Act
    const response = await axiosClient.get(testUrl);

    // Assert
    expect(response.status).toBe(200);
    expect(response.data).toEqual(successData);
    expect(mockAdapter.history.get).toHaveLength(2); // 1 initial + 1 retry
  });

  it('should retry once after 2 seconds and measure time between retries when response is 429 and Retry-After header is valid value', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Too Many Requests' };
    const successData = { message: 'success after rate limit retry' };
    const retryAfterSeconds = 2;

    mockAdapter
      .onGet(testUrl)
      .replyOnce(429, errorData, {
        'Retry-After': retryAfterSeconds.toString(),
      })
      .onGet(testUrl)
      .reply(200, successData);

    // Act
    const startTime = Date.now();
    const response = await axiosClient.get(testUrl);
    const endTime = Date.now();
    const actualWaitTime = endTime - startTime;

    // Assert
    expect(response.status).toBe(200);
    expect(response.data).toEqual(successData);
    expect(mockAdapter.history.get).toHaveLength(2); // 1 initial + 1 retry
    const expectedWaitTime = retryAfterSeconds * 1000;
    expect(actualWaitTime).toBeGreaterThanOrEqual(expectedWaitTime - 100);
    expect(actualWaitTime).toBeLessThan(expectedWaitTime + 1000); // Allow up to 1s extra for processing
  });

  it('should retry when response is 429 and Retry-After header is lowercase', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Too Many Requests' };
    const successData = { message: 'success after rate limit retry' };
    mockAdapter
      .onGet(testUrl)
      .replyOnce(429, errorData, { 'retry-after': '2' })
      .onGet(testUrl)
      .reply(200, successData);

    // Act
    const response = await axiosClient.get(testUrl);

    // Assert
    expect(response.status).toBe(200);
    expect(response.data).toEqual(successData);
    expect(mockAdapter.history.get).toHaveLength(2); // 1 initial + 1 retry
  });

  it('[edge] should not retry when response is 429 and there is no Retry-After header', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Too Many Requests' };
    mockAdapter.onGet(testUrl).reply(429, errorData);

    // Act
    await expect(axiosClient.get(testUrl)).rejects.toMatchObject({
      response: { status: 429 },
    });

    // Assert
    expect(mockAdapter.history.get).toHaveLength(1);
  });

  it('[edge] should retry when response is 429 and Retry-After header is 0', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Too Many Requests' };
    const successData = { message: 'success after rate limit retry' };
    mockAdapter
      .onGet(testUrl)
      .replyOnce(429, errorData, { 'Retry-After': '0' })
      .onGet(testUrl)
      .reply(200, successData);

    // Act
    const response = await axiosClient.get(testUrl);

    // Assert
    expect(response.status).toBe(200);
    expect(response.data).toEqual(successData);
    expect(mockAdapter.history.get).toHaveLength(2); // 1 initial + 1 retry
  });

  it('[edge] should not retry when response is 429 and Retry-After header is negative', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Too Many Requests' };
    mockAdapter.onGet(testUrl).reply(429, errorData, { 'Retry-After': '-1' });

    // Act
    await expect(axiosClient.get(testUrl)).rejects.toMatchObject({
      response: { status: 429 },
    });

    // Assert
    expect(mockAdapter.history.get).toHaveLength(1);
  });

  it('[edge] should not retry when response is 429 and Retry-After header is invalid value', async () => {
    // Arrange
    const testUrl = '/test-endpoint';
    const errorData = { error: 'Too Many Requests' };
    mockAdapter
      .onGet(testUrl)
      .reply(429, errorData, { 'Retry-After': 'invalid' });

    // Act
    await expect(axiosClient.get(testUrl)).rejects.toMatchObject({
      response: { status: 429 },
    });

    // Assert
    expect(mockAdapter.history.get).toHaveLength(1);
  });
});
