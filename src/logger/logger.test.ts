import { AxiosError } from 'axios';
import { inspect } from 'node:util';
import { LIBRARY_VERSION } from '../common/constants';
import { createEvent } from '../tests/test-helpers';
import { AirdropEvent, EventType } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';
import {
  getPrintableState,
  Logger,
  serializeAxiosError,
  serializeError,
} from './logger';
import {
  INSPECT_OPTIONS as EXPECTED_INSPECT_OPTIONS,
  MAX_LOG_STRING_LENGTH,
} from './logger.constants';

// Mock console methods
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();

// Mock worker_threads for main-thread specific behavior but keep actual Worker implementation
jest.mock('node:worker_threads', () => {
  const actual = jest.requireActual('node:worker_threads');
  return {
    ...actual,
    isMainThread: true,
    parentPort: null,
  };
});

describe(Logger.name, () => {
  let mockEvent: AirdropEvent;
  let mockOptions: WorkerAdapterOptions;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvent = createEvent({
      eventType: EventType.StartExtractingData,
      eventContextOverrides: {
        dev_org: 'DEV-test',
        dev_org_id: 'DEV-test-id',
        dev_user: 'DEVU-test',
        dev_user_id: 'DEVU-test-id',
        external_sync_unit: 'test-unit',
        external_sync_unit_id: 'test-unit-id',
        external_sync_unit_name: 'test-unit-name',
        external_system: 'test-system',
        external_system_type: 'test-type',
        import_slug: 'test-import',
        request_id: 'test-request-id',
        snap_in_slug: 'test-snap-slug',
        sync_run: 'test-sync-run',
        sync_run_id: 'test-sync-run-id',
      },
    });

    mockOptions = {
      isLocalDevelopment: false,
    };
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should initialize with event context and SDK version in tags', () => {
    // Arrange & Act
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Assert
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tags = (logger as any).tags;
    expect(tags).toEqual({
      ...mockEvent.payload.event_context,
      sdk_version: LIBRARY_VERSION,
      is_sdk_log: true,
    });
  });

  it('should log string message as JSON with event context tags in production mode', () => {
    // Arrange
    const message = 'Worker is online. Started processing the task.';
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info(message);

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      JSON.stringify({
        message,
        ...mockEvent.payload.event_context,
        sdk_version: LIBRARY_VERSION,
        is_sdk_log: true,
      })
    );
  });

  it('should log object message using inspect with proper formatting in production mode', () => {
    // Arrange
    const data = { id: 123, name: 'test' };
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedMessage = inspect(data, EXPECTED_INSPECT_OPTIONS);

    // Act
    logger.info(data);

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      JSON.stringify({
        message: expectedMessage,
        ...mockEvent.payload.event_context,
        sdk_version: LIBRARY_VERSION,
        is_sdk_log: true,
      })
    );
  });

  it('should join multiple arguments with space when logging in production mode', () => {
    // Arrange
    const text = 'Successfully fetched';
    const data = { count: 42 };
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedDataMessage = inspect(data, EXPECTED_INSPECT_OPTIONS);

    // Act
    logger.info(text, data);

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      JSON.stringify({
        message: `${text} ${expectedDataMessage}`,
        ...mockEvent.payload.event_context,
        sdk_version: LIBRARY_VERSION,
        is_sdk_log: true,
      })
    );
  });

  it('should log mixed string and object arguments joined with spaces in production mode', () => {
    // Arrange
    const text1 = 'Processing';
    const data = { id: 123 };
    const text2 = 'completed';
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedDataMessage = inspect(data, EXPECTED_INSPECT_OPTIONS);

    // Act
    logger.info(text1, data, text2);

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      JSON.stringify({
        message: `${text1} ${expectedDataMessage} ${text2}`,
        ...mockEvent.payload.event_context,
        sdk_version: LIBRARY_VERSION,
        is_sdk_log: true,
      })
    );
  });

  it('should log directly without JSON wrapping in local development mode', () => {
    // Arrange
    const message = 'Test message';
    const data = { test: true };
    mockOptions.isLocalDevelopment = true;
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedDataMessage = inspect(data, EXPECTED_INSPECT_OPTIONS);

    // Act
    logger.info(message, data);

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalledWith(
      `${message} ${expectedDataMessage}`
    );
  });

  it('should truncate long strings and show remaining character count', () => {
    // Arrange
    const longString = 'C'.repeat(20000);
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedTruncatedMessage = `${longString.substring(
      0,
      MAX_LOG_STRING_LENGTH
    )}... ${20000 - MAX_LOG_STRING_LENGTH} more characters`;

    // Act
    logger.info(longString);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe(expectedTruncatedMessage);
  });

  it('should not truncate strings shorter than maximum length', () => {
    // Arrange
    const shortString = 'Short message';
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info(shortString);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe(shortString);
  });

  it('[edge] should not truncate message exactly at maximum length', () => {
    // Arrange
    const messageAtLimit = 'A'.repeat(MAX_LOG_STRING_LENGTH);
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info(messageAtLimit);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe(messageAtLimit);
    expect(logObject.message.length).toBe(MAX_LOG_STRING_LENGTH);
  });

  it('[edge] should truncate message one character over maximum length', () => {
    // Arrange
    const messageOverLimit = 'B'.repeat(MAX_LOG_STRING_LENGTH + 1);
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedMessage = `${messageOverLimit.substring(
      0,
      MAX_LOG_STRING_LENGTH
    )}... 1 more characters`;

    // Act
    logger.info(messageOverLimit);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe(expectedMessage);
  });

  it('[edge] should handle empty string without truncation', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info('');

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe('');
  });

  it('[edge] should show correct character count for very long messages', () => {
    // Arrange
    const veryLongString = 'X'.repeat(50000);
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedCharactersRemaining = 50000 - MAX_LOG_STRING_LENGTH;
    const expectedMessage = `${veryLongString.substring(
      0,
      MAX_LOG_STRING_LENGTH
    )}... ${expectedCharactersRemaining} more characters`;

    // Act
    logger.info(veryLongString);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe(expectedMessage);
    expect(logObject.message).toContain('40000 more characters');
  });

  it('should stringify string arguments and join them with spaces', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info('Message 1', 'Message 2');

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe('Message 1 Message 2');
  });

  it('should stringify object arguments using util.inspect', () => {
    // Arrange
    const data = { id: 123 };
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedMessage = inspect(data, EXPECTED_INSPECT_OPTIONS);

    // Act
    logger.info(data);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe(expectedMessage);
  });

  it('should call info method for log level', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.log('test log');

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
  });

  it('should call info method for info level', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info('test info');

    // Assert
    expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
  });

  it('should call warn method for warn level', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.warn('test warning');

    // Assert
    expect(mockConsoleWarn).toHaveBeenCalledTimes(1);
  });

  it('should call error method for error level', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.error('test error');

    // Assert
    expect(mockConsoleError).toHaveBeenCalledTimes(1);
  });

  it('[edge] should log empty string as valid message with tags', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info('');

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe('');
    expect(logObject.sdk_version).toBe(LIBRARY_VERSION);
    expect(logObject.is_sdk_log).toBe(true);
  });

  it('[edge] should handle null and undefined values in log arguments', () => {
    // Arrange
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act
    logger.info('test', null, undefined);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe('test null undefined');
  });

  it('[edge] should handle deeply nested objects with inspect', () => {
    // Arrange
    const complexObject = {
      level1: {
        level2: {
          array: [1, 2, 3],
          string: 'nested',
        },
      },
    };
    const logger = new Logger({ event: mockEvent, options: mockOptions });
    const expectedMessage = inspect(complexObject, EXPECTED_INSPECT_OPTIONS);

    // Act
    logger.info(complexObject);

    // Assert
    const callArgs = mockConsoleInfo.mock.calls[0][0];
    const logObject = JSON.parse(callArgs);
    expect(logObject.message).toBe(expectedMessage);
  });

  it('[edge] should handle circular references in objects', () => {
    // Arrange
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const circularObject: any = { name: 'test' };
    circularObject.self = circularObject;
    const logger = new Logger({ event: mockEvent, options: mockOptions });

    // Act & Assert
    expect(() => logger.info(circularObject)).not.toThrow();
    expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
  });
});

describe(getPrintableState.name, () => {
  it('should convert arrays to summary objects with type, length, and boundary items', () => {
    // Arrange
    const state = {
      test_key: 'test_value',
      big_array: Array.from({ length: 1000 }, (_, index) => index),
    };

    // Act
    const printableState = getPrintableState(state);

    // Assert
    expect(printableState).toEqual({
      test_key: 'test_value',
      big_array: {
        type: 'array',
        length: 1000,
        firstItem: 0,
        lastItem: 999,
      },
    });
  });

  it('should recursively process nested objects and arrays', () => {
    // Arrange
    const state = {
      test_key: 'test_value',
      nested_object: {
        nested_key: 'nested_value',
        nested_array: Array.from({ length: 1000 }, (_, index) => index),
      },
    };

    // Act
    const printableState = getPrintableState(state);

    // Assert
    expect(printableState).toEqual({
      test_key: 'test_value',
      nested_object: {
        nested_key: 'nested_value',
        nested_array: {
          type: 'array',
          length: 1000,
          firstItem: 0,
          lastItem: 999,
        },
      },
    });
  });

  it('should preserve primitive values without modification', () => {
    // Arrange
    const state = {
      string_key: 'string_value',
      number_key: 42,
      boolean_key: true,
      null_key: null,
    };

    // Act
    const printableState = getPrintableState(state);

    // Assert
    expect(printableState).toEqual(state);
  });

  it('[edge] should handle empty arrays with no first or last items', () => {
    // Arrange
    const state = {
      empty_array: [],
    };

    // Act
    const printableState = getPrintableState(state);

    // Assert
    expect(printableState).toEqual({
      empty_array: {
        type: 'array',
        length: 0,
        firstItem: undefined,
        lastItem: undefined,
      },
    });
  });

  it('[edge] should handle single-item arrays with same first and last item', () => {
    // Arrange
    const state = {
      single_item_array: [42],
    };

    // Act
    const printableState = getPrintableState(state);

    // Assert
    expect(printableState).toEqual({
      single_item_array: {
        type: 'array',
        length: 1,
        firstItem: 42,
        lastItem: undefined,
      },
    });
  });
});

describe(serializeError.name, () => {
  it('should return the error message string for a standard Error', () => {
    const error = new Error('something went wrong');
    expect(serializeError(error)).toBe('something went wrong');
  });

  it('should include error name for named error types', () => {
    const typeError = new TypeError('invalid type');
    expect(serializeError(typeError)).toBe('TypeError: invalid type');

    const rangeError = new RangeError('out of range');
    expect(serializeError(rangeError)).toBe('RangeError: out of range');
  });

  it('should return a JSON string for an Axios error', () => {
    const axiosError = {
      isAxiosError: true,
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        data: 'fail',
        headers: {},
      },
      config: { method: 'GET', url: '/api/test', params: undefined },
    } as unknown as AxiosError;
    const result = serializeError(axiosError);
    expect(typeof result).toBe('string');
    const parsed = JSON.parse(result as string);
    expect(parsed.isAxiosError).toBe(true);
    expect(parsed.response.status).toBe(500);
  });

  it('should return a JSON string for a plain object', () => {
    const obj = { code: 42, detail: 'bad input' };
    const result = serializeError(obj);
    expect(typeof result).toBe('string');
    expect(JSON.parse(result as string)).toEqual(obj);
  });

  it('should return a JSON string for a string value', () => {
    expect(serializeError('raw string error')).toBe('raw string error');
  });

  it('[edge] should handle null without throwing', () => {
    const result = serializeError(null);
    expect(typeof result).toBe('string');
    expect(result).toBe('null');
  });

  it('[edge] should handle undefined without throwing', () => {
    const result = serializeError(undefined);
    expect(typeof result).toBe('string');
  });

  it('[edge] should fall back to extracting own properties for objects that stringify to empty object', () => {
    // Simulate an error-like object with non-enumerable properties
    // (e.g. cross-realm Error that fails instanceof check)
    const errorLike = Object.create(null);
    Object.defineProperty(errorLike, 'message', {
      value: 'cross-realm error',
      enumerable: false,
    });

    const result = serializeError(errorLike);
    expect(typeof result).toBe('string');
    // Should not be '{}' — that's the whole point of the fix
    expect(result).not.toBe('{}');
    // Should have extracted the non-enumerable 'message' property
    expect(result).toContain('cross-realm error');
  });
});

describe(serializeAxiosError.name, () => {
  it('should serialize Axios error with response data', () => {
    // Arrange
    const error = {
      response: {
        status: 500,
        statusText: 'Internal Server Error',
        data: 'Internal server error',
        headers: { 'content-type': 'application/json' },
      },
      config: {
        method: 'GET',
        url: '/api/test',
        params: { id: 123 },
      },
    } as unknown as AxiosError;

    // Act
    const formattedError = serializeAxiosError(error);

    // Assert
    expect(formattedError).toEqual({
      config: {
        method: 'GET',
        params: { id: 123 },
        url: '/api/test',
      },
      isAxiosError: true,
      isCorsOrNoNetworkError: false,
      response: {
        data: 'Internal server error',
        headers: { 'content-type': 'application/json' },
        status: 500,
        statusText: 'Internal Server Error',
      },
    });
  });

  it('should serialize Axios error without response as CORS or network error', () => {
    // Arrange
    const error = {
      code: 'ERR_NETWORK',
      message: 'Network Error',
      config: {
        method: 'POST',
        url: '/api/create',
      },
    } as unknown as AxiosError;

    // Act
    const formattedError = serializeAxiosError(error);

    // Assert
    expect(formattedError).toEqual({
      config: {
        method: 'POST',
        params: undefined,
        url: '/api/create',
      },
      isAxiosError: true,
      isCorsOrNoNetworkError: true,
      code: 'ERR_NETWORK',
      message: 'Network Error',
    });
  });

  it('[edge] should handle Axios error with minimal config information', () => {
    // Arrange
    const error = {
      response: {
        status: 404,
        data: 'Not Found',
      },
      config: {},
    } as unknown as AxiosError;

    // Act
    const formattedError = serializeAxiosError(error);

    // Assert
    expect(formattedError).toEqual({
      config: {
        method: undefined,
        params: undefined,
        url: undefined,
      },
      isAxiosError: true,
      isCorsOrNoNetworkError: false,
      response: {
        data: 'Not Found',
        headers: undefined,
        status: 404,
        statusText: undefined,
      },
    });
  });

  it('[edge] should handle Axios error with no config', () => {
    // Arrange
    const error = {
      code: 'ERR_TIMEOUT',
      message: 'Request timeout',
    } as unknown as AxiosError;

    // Act
    const formattedError = serializeAxiosError(error);

    // Assert
    expect(formattedError).toEqual({
      config: {
        method: undefined,
        params: undefined,
        url: undefined,
      },
      isAxiosError: true,
      isCorsOrNoNetworkError: true,
      code: 'ERR_TIMEOUT',
      message: 'Request timeout',
    });
  });
});
