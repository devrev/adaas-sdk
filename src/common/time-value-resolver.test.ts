import { TimeValueType } from '../types/extraction';
import { SdkState } from '../state/state.interfaces';
import {
  parseDuration,
  subtractDuration,
  addDuration,
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

  describe('subtractDuration', () => {
    it('should subtract days', () => {
      const result = subtractDuration('2024-01-15T00:00:00.000Z', '7d');
      expect(result).toBe('2024-01-08T00:00:00.000Z');
    });

    it('should subtract months', () => {
      const result = subtractDuration('2024-03-15T00:00:00.000Z', '2m');
      expect(result).toBe('2024-01-15T00:00:00.000Z');
    });

    it('should subtract years', () => {
      const result = subtractDuration('2024-06-15T00:00:00.000Z', '1y');
      expect(result).toBe('2023-06-15T00:00:00.000Z');
    });

    it('should handle crossing year boundary', () => {
      const result = subtractDuration('2024-01-15T00:00:00.000Z', '2m');
      expect(result).toBe('2023-11-15T00:00:00.000Z');
    });
  });

  describe('addDuration', () => {
    it('should add days', () => {
      const result = addDuration('2024-01-15T00:00:00.000Z', '7d');
      expect(result).toBe('2024-01-22T00:00:00.000Z');
    });

    it('should add months', () => {
      const result = addDuration('2024-01-15T00:00:00.000Z', '2m');
      expect(result).toBe('2024-03-15T00:00:00.000Z');
    });

    it('should add years', () => {
      const result = addDuration('2024-06-15T00:00:00.000Z', '1y');
      expect(result).toBe('2025-06-15T00:00:00.000Z');
    });

    it('should handle crossing year boundary', () => {
      const result = addDuration('2024-11-15T00:00:00.000Z', '2m');
      expect(result).toBe('2025-01-15T00:00:00.000Z');
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

      it('should throw if workers_oldest is not set', () => {
        expect(() =>
          resolveTimeValue(
            { type: TimeValueType.WORKERS_OLDEST },
            { workers_oldest: '' }
          )
        ).toThrow('workers_oldest is not set');
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

      it('should throw if workers_newest is not set', () => {
        expect(() =>
          resolveTimeValue(
            { type: TimeValueType.WORKERS_NEWEST },
            { workers_newest: '' }
          )
        ).toThrow('workers_newest is not set');
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

      it('should throw if workers_oldest is not set', () => {
        expect(() =>
          resolveTimeValue(
            {
              type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
              value: '7d',
            },
            { workers_oldest: '' }
          )
        ).toThrow('workers_oldest is not set');
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

      it('should throw if workers_newest is not set', () => {
        expect(() =>
          resolveTimeValue(
            {
              type: TimeValueType.WORKERS_NEWEST_PLUS_WINDOW,
              value: '7d',
            },
            { workers_newest: '' }
          )
        ).toThrow('workers_newest is not set');
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
