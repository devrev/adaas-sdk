import { TimeValueType } from '../types/extraction';
import { SdkState } from '../state/state.interfaces';
import {
  parseDuration,
  applyDuration,
  resolveTimeValue,
} from './time-value-resolver';

describe('time-value-resolver', () => {
  describe('parseDuration', () => {
    it('should parse days', () => {
      expect(parseDuration('7d')).toEqual({ value: 7, unit: 'd' });
      expect(parseDuration('1d')).toEqual({ value: 1, unit: 'd' });
      expect(parseDuration('30d')).toEqual({ value: 30, unit: 'd' });
      expect(parseDuration('365d')).toEqual({ value: 365, unit: 'd' });
    });

    it('should parse months', () => {
      expect(parseDuration('2m')).toEqual({ value: 2, unit: 'm' });
      expect(parseDuration('1m')).toEqual({ value: 1, unit: 'm' });
      expect(parseDuration('12m')).toEqual({ value: 12, unit: 'm' });
    });

    it('should parse years', () => {
      expect(parseDuration('1y')).toEqual({ value: 1, unit: 'y' });
      expect(parseDuration('5y')).toEqual({ value: 5, unit: 'y' });
    });

    it('should throw on invalid format', () => {
      expect(() => parseDuration('')).toThrow('Invalid duration format');
      expect(() => parseDuration('7')).toThrow('Invalid duration format');
      expect(() => parseDuration('d')).toThrow('Invalid duration format');
      expect(() => parseDuration('7h')).toThrow('Invalid duration format');
      expect(() => parseDuration('7.5d')).toThrow('Invalid duration format');
      expect(() => parseDuration('abc')).toThrow('Invalid duration format');
    });
  });

  describe('applyDuration', () => {
    describe('subtract', () => {
      it('should subtract days', () => {
        const result = applyDuration(
          '2024-01-15T00:00:00.000Z',
          '7d',
          'subtract'
        );
        expect(result).toBe('2024-01-08T00:00:00.000Z');
      });

      it('should subtract months', () => {
        const result = applyDuration(
          '2024-03-15T00:00:00.000Z',
          '2m',
          'subtract'
        );
        expect(result).toBe('2024-01-15T00:00:00.000Z');
      });

      it('should subtract years', () => {
        const result = applyDuration(
          '2024-06-15T00:00:00.000Z',
          '1y',
          'subtract'
        );
        expect(result).toBe('2023-06-15T00:00:00.000Z');
      });

      it('should handle crossing year boundary', () => {
        const result = applyDuration(
          '2024-01-15T00:00:00.000Z',
          '2m',
          'subtract'
        );
        expect(result).toBe('2023-11-15T00:00:00.000Z');
      });
    });

    describe('add', () => {
      it('should add days', () => {
        const result = applyDuration('2024-01-15T00:00:00.000Z', '7d', 'add');
        expect(result).toBe('2024-01-22T00:00:00.000Z');
      });

      it('should add months', () => {
        const result = applyDuration('2024-01-15T00:00:00.000Z', '2m', 'add');
        expect(result).toBe('2024-03-15T00:00:00.000Z');
      });

      it('should add years', () => {
        const result = applyDuration('2024-06-15T00:00:00.000Z', '1y', 'add');
        expect(result).toBe('2025-06-15T00:00:00.000Z');
      });

      it('should handle crossing year boundary', () => {
        const result = applyDuration('2024-11-15T00:00:00.000Z', '2m', 'add');
        expect(result).toBe('2025-01-15T00:00:00.000Z');
      });
    });
  });

  describe('resolveTimeValue', () => {
    const baseState: SdkState = {
      lastSyncStarted: '',
      lastSuccessfulSyncStarted: '',
      workers_oldest: '2024-01-01T00:00:00.000Z',
      workers_newest: '2024-06-01T00:00:00.000Z',
    };

    describe('ABSOLUTE type', () => {
      it('should return the value directly', () => {
        const result = resolveTimeValue(
          { type: TimeValueType.ABSOLUTE, value: '2024-03-15T12:00:00Z' },
          baseState
        );
        expect(result).toBe('2024-03-15T12:00:00Z');
      });

      it('should throw if value is missing', () => {
        expect(() =>
          resolveTimeValue({ type: TimeValueType.ABSOLUTE }, baseState)
        ).toThrow('must have a value');
      });
    });

    describe('NOW type', () => {
      it('should return current time as ISO string', () => {
        const before = new Date().toISOString();
        const result = resolveTimeValue({ type: TimeValueType.NOW }, baseState);
        const after = new Date().toISOString();

        expect(result).toBeDefined();
        expect(result! >= before).toBe(true);
        expect(result! <= after).toBe(true);
      });
    });

    describe('UNBOUNDED type', () => {
      it('should return undefined', () => {
        const result = resolveTimeValue(
          { type: TimeValueType.UNBOUNDED },
          baseState
        );
        expect(result).toBeUndefined();
      });
    });

    describe('WORKERS_OLDEST type', () => {
      it('should return workers_oldest from state', () => {
        const result = resolveTimeValue(
          { type: TimeValueType.WORKERS_OLDEST },
          baseState
        );
        expect(result).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should fall back to current time if workers_oldest is not set', () => {
        const before = new Date().toISOString();
        const result = resolveTimeValue(
          { type: TimeValueType.WORKERS_OLDEST },
          { workers_oldest: '' }
        );
        const after = new Date().toISOString();

        expect(result).toBeDefined();
        expect(result! >= before).toBe(true);
        expect(result! <= after).toBe(true);
      });
    });

    describe('WORKERS_NEWEST type', () => {
      it('should return workers_newest from state', () => {
        const result = resolveTimeValue(
          { type: TimeValueType.WORKERS_NEWEST },
          baseState
        );
        expect(result).toBe('2024-06-01T00:00:00.000Z');
      });

      it('should fall back to current time if workers_newest is not set', () => {
        const before = new Date().toISOString();
        const result = resolveTimeValue(
          { type: TimeValueType.WORKERS_NEWEST },
          { workers_newest: '' }
        );
        const after = new Date().toISOString();

        expect(result).toBeDefined();
        expect(result! >= before).toBe(true);
        expect(result! <= after).toBe(true);
      });
    });

    describe('WORKERS_OLDEST_MINUS_WINDOW type', () => {
      it('should subtract duration from workers_oldest', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
            value: '7d',
          },
          baseState
        );
        expect(result).toBe('2023-12-25T00:00:00.000Z');
      });

      it('should subtract months from workers_oldest', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
            value: '2m',
          },
          baseState
        );
        expect(result).toBe('2023-11-01T00:00:00.000Z');
      });

      it('should fall back to current time if workers_oldest is not set', () => {
        const before = new Date();
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
            value: '7d',
          },
          { workers_oldest: '' }
        );
        const after = new Date();

        // Result should be roughly now minus 7 days
        const resultDate = new Date(result!);
        const expectedMin = new Date(before);
        expectedMin.setUTCDate(expectedMin.getUTCDate() - 7);
        const expectedMax = new Date(after);
        expectedMax.setUTCDate(expectedMax.getUTCDate() - 7);

        expect(resultDate.getTime()).toBeGreaterThanOrEqual(
          expectedMin.getTime()
        );
        expect(resultDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
      });

      it('should throw if value (duration) is missing', () => {
        expect(() =>
          resolveTimeValue(
            { type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW },
            baseState
          )
        ).toThrow('must have a value');
      });
    });

    describe('WORKERS_NEWEST_PLUS_WINDOW type', () => {
      it('should add duration to workers_newest', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_NEWEST_PLUS_WINDOW,
            value: '7d',
          },
          baseState
        );
        expect(result).toBe('2024-06-08T00:00:00.000Z');
      });

      it('should add months to workers_newest', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_NEWEST_PLUS_WINDOW,
            value: '2m',
          },
          baseState
        );
        expect(result).toBe('2024-08-01T00:00:00.000Z');
      });

      it('should fall back to current time if workers_newest is not set', () => {
        const before = new Date();
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_NEWEST_PLUS_WINDOW,
            value: '7d',
          },
          { workers_newest: '' }
        );
        const after = new Date();

        // Result should be roughly now plus 7 days
        const resultDate = new Date(result!);
        const expectedMin = new Date(before);
        expectedMin.setUTCDate(expectedMin.getUTCDate() + 7);
        const expectedMax = new Date(after);
        expectedMax.setUTCDate(expectedMax.getUTCDate() + 7);

        expect(resultDate.getTime()).toBeGreaterThanOrEqual(
          expectedMin.getTime()
        );
        expect(resultDate.getTime()).toBeLessThanOrEqual(expectedMax.getTime());
      });

      it('should throw if value (duration) is missing', () => {
        expect(() =>
          resolveTimeValue(
            { type: TimeValueType.WORKERS_NEWEST_PLUS_WINDOW },
            baseState
          )
        ).toThrow('must have a value');
      });
    });

    describe('Unknown type', () => {
      it('should throw for unknown type', () => {
        expect(() =>
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          resolveTimeValue({ type: 'unknown' as any }, baseState)
        ).toThrow('Unknown TimeValueType');
      });
    });
  });
});
