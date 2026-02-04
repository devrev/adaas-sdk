import { EventData } from '../types/extraction';
import {
  EVENT_SIZE_THRESHOLD_BYTES,
  MAX_EVENT_SIZE_BYTES,
  pruneEventData,
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
