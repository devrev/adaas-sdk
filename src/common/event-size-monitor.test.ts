import { ErrorRecord } from '../types/common';
import { EventData } from '../types/extraction';
import {
  EVENT_SIZE_THRESHOLD_BYTES,
  MAX_EVENT_SIZE_BYTES,
  pruneEventData,
  truncateErrorMessage,
} from './event-size-monitor';

describe('event-size-monitor constants', () => {
  it('should have MAX_EVENT_SIZE_BYTES set to 200KB', () => {
    expect(MAX_EVENT_SIZE_BYTES).toBe(200_000);
  });

  it('should have EVENT_SIZE_THRESHOLD_BYTES set to 80% of MAX_EVENT_SIZE_BYTES', () => {
    expect(EVENT_SIZE_THRESHOLD_BYTES).toBe(Math.floor(200_000 * 0.8));
    expect(EVENT_SIZE_THRESHOLD_BYTES).toBe(160_000);
  });
});

describe(truncateErrorMessage.name, () => {
  it('should return undefined when error is undefined', () => {
    const result = truncateErrorMessage(undefined);
    expect(result).toBeUndefined();
  });

  it('should return error with empty message when error.message is undefined', () => {
    const error = {} as ErrorRecord;
    const result = truncateErrorMessage(error);
    expect(result).toEqual({ message: '' });
  });

  it('should return error unchanged when message is shorter than maxLength', () => {
    const error: ErrorRecord = { message: 'Short error message' };
    const result = truncateErrorMessage(error);
    expect(result).toEqual({ message: 'Short error message' });
  });

  it('should truncate message to default 1000 characters', () => {
    const longMessage = 'a'.repeat(1500);
    const error: ErrorRecord = { message: longMessage };
    const result = truncateErrorMessage(error);
    expect(result?.message.length).toBe(1000);
    expect(result?.message).toBe('a'.repeat(1000));
  });

  it('should truncate message to custom maxLength', () => {
    const longMessage = 'a'.repeat(500);
    const error: ErrorRecord = { message: longMessage };
    const result = truncateErrorMessage(error, 100);
    expect(result?.message.length).toBe(100);
    expect(result?.message).toBe('a'.repeat(100));
  });

  it('should handle message exactly at maxLength boundary', () => {
    const exactMessage = 'b'.repeat(1000);
    const error: ErrorRecord = { message: exactMessage };
    const result = truncateErrorMessage(error);
    expect(result?.message.length).toBe(1000);
    expect(result?.message).toBe(exactMessage);
  });

  it('should handle empty message string', () => {
    const error: ErrorRecord = { message: '' };
    const result = truncateErrorMessage(error);
    expect(result).toEqual({ message: '' });
  });

  it('should preserve special characters when truncating', () => {
    const specialMessage = '🔥'.repeat(600) + 'abc';
    const error: ErrorRecord = { message: specialMessage };
    const result = truncateErrorMessage(error, 10);
    // Note: substring works on code units, not graphemes
    expect(result?.message.length).toBe(10);
  });
});

describe(pruneEventData.name, () => {
  it('should return undefined when data is undefined', () => {
    const result = pruneEventData(undefined);
    expect(result).toBeUndefined();
  });

  it('should return data unchanged when there is no error field', () => {
    const data: EventData = {
      external_sync_units: [
        { id: 'unit1', name: 'Unit 1', description: 'Test unit' },
      ],
    };
    const result = pruneEventData(data);
    expect(result).toEqual({
      ...data,
      error: undefined,
    });
  });

  it('should truncate error message in event data', () => {
    const longMessage = 'x'.repeat(2000);
    const data: EventData = {
      error: { message: longMessage },
    };
    const result = pruneEventData(data);
    expect(result?.error?.message.length).toBe(1000);
    expect(result?.error?.message).toBe('x'.repeat(1000));
  });

  it('should preserve other fields when pruning error', () => {
    const data: EventData = {
      external_sync_units: [
        { id: 'unit1', name: 'Unit 1', description: 'Test unit' },
      ],
      error: { message: 'a'.repeat(1500) },
    };
    const result = pruneEventData(data);

    expect(result?.external_sync_units).toEqual(data.external_sync_units);
    expect(result?.error?.message.length).toBe(1000);
  });

  it('should handle empty EventData object', () => {
    const data: EventData = {};
    const result = pruneEventData(data);
    expect(result).toEqual({ error: undefined });
  });

  it('should handle error with short message without truncation', () => {
    const data: EventData = {
      error: { message: 'Simple error' },
    };
    const result = pruneEventData(data);
    expect(result?.error?.message).toBe('Simple error');
  });

  it('should handle undefined error in data', () => {
    const data: EventData = {
      external_sync_units: [],
      error: undefined,
    };
    const result = pruneEventData(data);
    expect(result?.error).toBeUndefined();
  });
});
