import { AxiosError } from 'axios';
import { inspect } from 'node:util';
import { getPrintableState, serializeAxiosError, Logger } from './logger';
import { LogLevel } from './logger.interfaces';
import { AirdropEvent, EventType } from '../types/extraction';
import { WorkerAdapterOptions } from '../types/workers';
import { createEvent } from '../tests/test-helpers';

// Mock console methods
const mockConsoleInfo = jest.spyOn(console, 'info').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();

// Mock worker_threads
jest.mock('node:worker_threads', () => ({
  isMainThread: true,
  parentPort: null,
}));

describe('Logger', () => {
  let mockEvent: AirdropEvent;
  let mockOptions: WorkerAdapterOptions;

  beforeEach(() => {
    jest.clearAllMocks();

    mockEvent = createEvent({
      eventType: EventType.ExtractionDataStart,
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

  describe('constructor', () => {
    it('should initialize logger with event context and dev_oid', () => {
      const logger = new Logger({ event: mockEvent, options: mockOptions });

      // Access private property for testing
      const tags = (logger as any).tags;

      expect(tags).toEqual({
        ...mockEvent.payload.event_context,
        dev_oid: mockEvent.payload.event_context.dev_org,
      });
    });
  });

  describe('production logging', () => {
    let logger: Logger;

    beforeEach(() => {
      mockOptions.isLocalDevelopment = false;
      logger = new Logger({ event: mockEvent, options: mockOptions });
    });

    it('should log single string message without backslashes', () => {
      const message = 'Worker is online. Started processing the task.';

      logger.info(message);

      expect(mockConsoleInfo).toHaveBeenCalledWith(
        JSON.stringify({
          message,
          ...mockEvent.payload.event_context,
          dev_oid: mockEvent.payload.event_context.dev_org,
        })
      );
    });

    it('should log single object message with JSON stringify', () => {
      const data = { id: 123, name: 'test' };

      logger.info(data);

      const expectedMessage = inspect(data, {
        compact: false,
        depth: Infinity,
      });
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        JSON.stringify({
          message: expectedMessage,
          ...mockEvent.payload.event_context,
          dev_oid: mockEvent.payload.event_context.dev_org,
        })
      );
    });

    it('should log multiple arguments joined with space', () => {
      const text = 'Successfully fetched';
      const data = { count: 42 };

      logger.info(text, data);

      const expectedDataMessage = inspect(data, {
        compact: false,
        depth: Infinity,
      });
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        JSON.stringify({
          message: `${text} ${expectedDataMessage}`,
          ...mockEvent.payload.event_context,
          dev_oid: mockEvent.payload.event_context.dev_org,
        })
      );
    });

    it('should handle mixed string and object arguments', () => {
      const text1 = 'Processing';
      const data = { id: 123 };
      const text2 = 'completed';

      logger.info(text1, data, text2);

      const expectedDataMessage = inspect(data, {
        compact: false,
        depth: Infinity,
      });
      expect(mockConsoleInfo).toHaveBeenCalledWith(
        JSON.stringify({
          message: `${text1} ${expectedDataMessage} ${text2}`,
          ...mockEvent.payload.event_context,
          dev_oid: mockEvent.payload.event_context.dev_org,
        })
      );
    });
  });

  describe('local development logging', () => {
    let logger: Logger;

    beforeEach(() => {
      mockOptions.isLocalDevelopment = true;
      logger = new Logger({ event: mockEvent, options: mockOptions });
    });

    it('should use regular console methods in local development', () => {
      const message = 'Test message';
      const data = { test: true };

      logger.info(message, data);

      expect(mockConsoleInfo).toHaveBeenCalledWith(message, data);
    });
  });

  describe('log levels', () => {
    let logger: Logger;

    beforeEach(() => {
      mockOptions.isLocalDevelopment = false;
      logger = new Logger({ event: mockEvent, options: mockOptions });
    });

    it('should call console.info for info level', () => {
      logger.info('test message');
      expect(mockConsoleInfo).toHaveBeenCalled();
    });

    it('should call console.warn for warn level', () => {
      logger.warn('test warning');
      expect(mockConsoleWarn).toHaveBeenCalled();
    });

    it('should call console.error for error level', () => {
      logger.error('test error');
      expect(mockConsoleError).toHaveBeenCalled();
    });

    it('should call console.info for log level', () => {
      logger.log('test log');
      expect(mockConsoleInfo).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    let logger: Logger;

    beforeEach(() => {
      mockOptions.isLocalDevelopment = false;
      logger = new Logger({ event: mockEvent, options: mockOptions });
    });

    it('should handle empty string message', () => {
      logger.info('');

      expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
      const callArgs = mockConsoleInfo.mock.calls[0][0];
      const logObject = JSON.parse(callArgs);

      expect(logObject.message).toBe('');
      expect(logObject.dev_oid).toBe(mockEvent.payload.event_context.dev_org);
      expect(logObject.request_id).toBe(
        mockEvent.payload.event_context.request_id
      );
    });

    it('should handle null and undefined values', () => {
      logger.info('test', null, undefined);

      expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
      const callArgs = mockConsoleInfo.mock.calls[0][0];
      const logObject = JSON.parse(callArgs);

      // inspect shows 'null' and 'undefined' as strings
      expect(logObject.message).toBe('test null undefined');
      expect(logObject.dev_oid).toBe(mockEvent.payload.event_context.dev_org);
    });

    it('should handle complex nested objects', () => {
      const complexObject = {
        level1: {
          level2: {
            array: [1, 2, 3],
            string: 'nested',
          },
        },
      };

      logger.info(complexObject);

      expect(mockConsoleInfo).toHaveBeenCalledTimes(1);
      const callArgs = mockConsoleInfo.mock.calls[0][0];
      const logObject = JSON.parse(callArgs);

      // The logger uses inspect() with formatting, not JSON.stringify()
      const expectedMessage = require('util').inspect(complexObject, {
        compact: false,
        depth: Infinity,
      });
      expect(logObject.message).toBe(expectedMessage);
      expect(logObject.dev_oid).toBe(mockEvent.payload.event_context.dev_org);
      expect(typeof logObject.callback_url).toBe('string');
    });
  });
});

it('getPrintableState should return printable state', () => {
  const state = {
    test_key: 'test_value',
    big_array: Array.from({ length: 1000 }, (_, index) => index),
    nested_object: {
      nested_key: 'nested_value',
      nested_array: Array.from({ length: 1000 }, (_, index) => index),
    },
  };

  const printableState = getPrintableState(state);

  expect(printableState).toEqual({
    test_key: 'test_value',
    big_array: {
      type: 'array',
      length: 1000,
      firstItem: 0,
      lastItem: 999,
    },
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

it('serializeAxiosError should return formatted error', () => {
  const error = {
    response: {
      status: 500,
      data: 'Internal server error',
    },
    config: {
      method: 'GET',
    },
  } as AxiosError;

  const formattedError = serializeAxiosError(error);

  expect(formattedError).toEqual({
    config: {
      method: 'GET',
      params: undefined,
      url: undefined,
    },
    isAxiosError: true,
    isCorsOrNoNetworkError: false,
    response: {
      data: 'Internal server error',
      headers: undefined,
      status: 500,
      statusText: undefined,
    },
  });
});
