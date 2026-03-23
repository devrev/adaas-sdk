import { TimeValueType } from '../types/extraction';
import { SdkState, UNBOUNDED_DATE_TIME_VALUE } from '../state/state.interfaces';
import {
  parseDuration,
  applyDuration,
  resolveTimeValue,
} from './time-value-resolver';

describe('time-value-resolver', () => {
  describe('parseDuration', () => {
    it('should parse nanoseconds', () => {
      expect(parseDuration('100ns')).toEqual({ value: 100, unit: 'ns' });
      expect(parseDuration('1ns')).toEqual({ value: 1, unit: 'ns' });
    });

    it('should parse microseconds', () => {
      expect(parseDuration('500us')).toEqual({ value: 500, unit: 'us' });
      expect(parseDuration('500µs')).toEqual({ value: 500, unit: 'µs' });
    });

    it('should parse milliseconds', () => {
      expect(parseDuration('250ms')).toEqual({ value: 250, unit: 'ms' });
      expect(parseDuration('1ms')).toEqual({ value: 1, unit: 'ms' });
    });

    it('should parse seconds', () => {
      expect(parseDuration('30s')).toEqual({ value: 30, unit: 's' });
      expect(parseDuration('1s')).toEqual({ value: 1, unit: 's' });
      expect(parseDuration('3600s')).toEqual({ value: 3600, unit: 's' });
    });

    it('should parse minutes', () => {
      expect(parseDuration('5m')).toEqual({ value: 5, unit: 'm' });
      expect(parseDuration('1m')).toEqual({ value: 1, unit: 'm' });
      expect(parseDuration('60m')).toEqual({ value: 60, unit: 'm' });
    });

    it('should parse hours', () => {
      expect(parseDuration('2h')).toEqual({ value: 2, unit: 'h' });
      expect(parseDuration('24h')).toEqual({ value: 24, unit: 'h' });
      expect(parseDuration('168h')).toEqual({ value: 168, unit: 'h' });
    });

    it('should parse fractional values', () => {
      expect(parseDuration('1.5h')).toEqual({ value: 1.5, unit: 'h' });
      expect(parseDuration('0.5s')).toEqual({ value: 0.5, unit: 's' });
      expect(parseDuration('2.5m')).toEqual({ value: 2.5, unit: 'm' });
    });

    it('should throw on invalid format', () => {
      expect(() => parseDuration('')).toThrow('Invalid duration format');
      expect(() => parseDuration('7')).toThrow('Invalid duration format');
      expect(() => parseDuration('s')).toThrow('Invalid duration format');
      expect(() => parseDuration('7d')).toThrow('Invalid duration format');
      expect(() => parseDuration('7y')).toThrow('Invalid duration format');
      expect(() => parseDuration('abc')).toThrow('Invalid duration format');
    });
  });

  describe('applyDuration', () => {
    describe('subtract', () => {
      it('should subtract seconds', () => {
        const result = applyDuration(
          '2024-01-15T00:00:30.000Z',
          '30s',
          'subtract'
        );
        expect(result).toBe('2024-01-15T00:00:00.000Z');
      });

      it('should subtract minutes', () => {
        const result = applyDuration(
          '2024-01-15T00:05:00.000Z',
          '5m',
          'subtract'
        );
        expect(result).toBe('2024-01-15T00:00:00.000Z');
      });

      it('should subtract hours', () => {
        const result = applyDuration(
          '2024-01-15T02:00:00.000Z',
          '2h',
          'subtract'
        );
        expect(result).toBe('2024-01-15T00:00:00.000Z');
      });

      it('should subtract milliseconds', () => {
        const result = applyDuration(
          '2024-01-15T00:00:00.500Z',
          '500ms',
          'subtract'
        );
        expect(result).toBe('2024-01-15T00:00:00.000Z');
      });

      it('should handle crossing day boundary', () => {
        const result = applyDuration(
          '2024-01-15T01:00:00.000Z',
          '2h',
          'subtract'
        );
        expect(result).toBe('2024-01-14T23:00:00.000Z');
      });

      it('should subtract 168 hours (7 days equivalent)', () => {
        const result = applyDuration(
          '2024-01-15T00:00:00.000Z',
          '168h',
          'subtract'
        );
        expect(result).toBe('2024-01-08T00:00:00.000Z');
      });
    });

    describe('add', () => {
      it('should add seconds', () => {
        const result = applyDuration('2024-01-15T00:00:00.000Z', '30s', 'add');
        expect(result).toBe('2024-01-15T00:00:30.000Z');
      });

      it('should add minutes', () => {
        const result = applyDuration('2024-01-15T00:00:00.000Z', '5m', 'add');
        expect(result).toBe('2024-01-15T00:05:00.000Z');
      });

      it('should add hours', () => {
        const result = applyDuration('2024-01-15T00:00:00.000Z', '2h', 'add');
        expect(result).toBe('2024-01-15T02:00:00.000Z');
      });

      it('should add milliseconds', () => {
        const result = applyDuration(
          '2024-01-15T00:00:00.000Z',
          '500ms',
          'add'
        );
        expect(result).toBe('2024-01-15T00:00:00.500Z');
      });

      it('should handle crossing day boundary', () => {
        const result = applyDuration('2024-01-15T23:00:00.000Z', '2h', 'add');
        expect(result).toBe('2024-01-16T01:00:00.000Z');
      });

      it('should add 168 hours (7 days equivalent)', () => {
        const result = applyDuration('2024-01-15T00:00:00.000Z', '168h', 'add');
        expect(result).toBe('2024-01-22T00:00:00.000Z');
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

    describe('ABSOLUTE_TIME type', () => {
      it('should return the value normalized to ISO 8601', () => {
        const result = resolveTimeValue(
          { type: TimeValueType.ABSOLUTE_TIME, value: '2024-03-15T12:00:00Z' },
          baseState
        );
        expect(result).toBe('2024-03-15T12:00:00.000Z');
      });

      it('should normalize timestamps without milliseconds', () => {
        const result = resolveTimeValue(
          { type: TimeValueType.ABSOLUTE_TIME, value: '2024-01-01T00:00:00Z' },
          baseState
        );
        expect(result).toBe('2024-01-01T00:00:00.000Z');
      });

      it('should preserve timestamps already in normalized format', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.ABSOLUTE_TIME,
            value: '2024-06-15T10:30:00.000Z',
          },
          baseState
        );
        expect(result).toBe('2024-06-15T10:30:00.000Z');
      });

      it('should throw if value is missing', () => {
        expect(() =>
          resolveTimeValue({ type: TimeValueType.ABSOLUTE_TIME }, baseState)
        ).toThrow('must have a value');
      });

      it('should throw a descriptive error if value is an invalid timestamp', () => {
        expect(() =>
          resolveTimeValue(
            { type: TimeValueType.ABSOLUTE_TIME, value: 'not-a-date' },
            baseState
          )
        ).toThrow("invalid ISO 8601 timestamp: 'not-a-date'");
      });
    });

    describe('CURRENT_TIME type', () => {
      it('should return current time as ISO string', () => {
        const before = new Date().toISOString();
        const result = resolveTimeValue(
          { type: TimeValueType.CURRENT_TIME },
          baseState
        );
        const after = new Date().toISOString();

        expect(result).toBeDefined();
        expect(result! >= before).toBe(true);
        expect(result! <= after).toBe(true);
      });
    });

    describe('UNBOUNDED type', () => {
      it('should return UNBOUNDED_DATE_TIME_VALUE', () => {
        const result = resolveTimeValue(
          { type: TimeValueType.UNBOUNDED },
          baseState
        );
        expect(result).toBe(UNBOUNDED_DATE_TIME_VALUE);
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
        ).toThrow('workers_oldest is not set in state');
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
        ).toThrow('workers_newest is not set in state');
      });
    });

    describe('WORKERS_OLDEST_MINUS_WINDOW type', () => {
      it('should subtract duration from workers_oldest', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
            value: '168h',
          },
          baseState
        );
        expect(result).toBe('2023-12-25T00:00:00.000Z');
      });

      it('should subtract minutes from workers_oldest', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
            value: '30m',
          },
          baseState
        );
        expect(result).toBe('2023-12-31T23:30:00.000Z');
      });

      it('should throw if workers_oldest is not set', () => {
        expect(() =>
          resolveTimeValue(
            {
              type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW,
              value: '2h',
            },
            { workers_oldest: '' }
          )
        ).toThrow('workers_oldest is not set in state');
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
            value: '168h',
          },
          baseState
        );
        expect(result).toBe('2024-06-08T00:00:00.000Z');
      });

      it('should add minutes to workers_newest', () => {
        const result = resolveTimeValue(
          {
            type: TimeValueType.WORKERS_NEWEST_PLUS_WINDOW,
            value: '30m',
          },
          baseState
        );
        expect(result).toBe('2024-06-01T00:30:00.000Z');
      });

      it('should throw if workers_newest is not set', () => {
        expect(() =>
          resolveTimeValue(
            {
              type: TimeValueType.WORKERS_NEWEST_PLUS_WINDOW,
              value: '2h',
            },
            { workers_newest: '' }
          )
        ).toThrow('workers_newest is not set in state');
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

    describe('Real-world scenarios', () => {
      const FIXED_NOW = '2026-02-26T15:30:00.000Z';

      const scenarioState: SdkState = {
        lastSyncStarted: '',
        lastSuccessfulSyncStarted: '',
        workers_oldest: '2024-01-01T00:00:00.000Z',
        workers_newest: '2024-06-01T00:00:00.000Z',
      };

      beforeEach(() => {
        jest.useFakeTimers();
        jest.setSystemTime(new Date(FIXED_NOW));
      });

      afterEach(() => {
        jest.useRealTimers();
      });

      it('Initial Import: UNBOUNDED start, CURRENT_TIME end', () => {
        const start = resolveTimeValue(
          { type: TimeValueType.UNBOUNDED },
          scenarioState
        );
        const end = resolveTimeValue(
          { type: TimeValueType.CURRENT_TIME },
          scenarioState
        );

        expect(start).toBe(UNBOUNDED_DATE_TIME_VALUE);
        expect(end).toBe(FIXED_NOW);
      });

      it('Normal Import: WORKERS_NEWEST start, CURRENT_TIME end', () => {
        const start = resolveTimeValue(
          { type: TimeValueType.WORKERS_NEWEST },
          scenarioState
        );
        const end = resolveTimeValue(
          { type: TimeValueType.CURRENT_TIME },
          scenarioState
        );

        expect(start).toBe('2024-06-01T00:00:00.000Z');
        expect(end).toBe(FIXED_NOW);
      });

      it('POC Import: ABSOLUTE_TIME start, CURRENT_TIME end', () => {
        const start = resolveTimeValue(
          { type: TimeValueType.ABSOLUTE_TIME, value: '2024-01-01T00:00:00Z' },
          scenarioState
        );
        const end = resolveTimeValue(
          { type: TimeValueType.CURRENT_TIME },
          scenarioState
        );

        expect(start).toBe('2024-01-01T00:00:00.000Z');
        expect(end).toBe(FIXED_NOW);
      });

      it('Computer Import: WORKERS_OLDEST_MINUS_WINDOW start, WORKERS_OLDEST end', () => {
        const start = resolveTimeValue(
          { type: TimeValueType.WORKERS_OLDEST_MINUS_WINDOW, value: '168h' },
          scenarioState
        );
        const end = resolveTimeValue(
          { type: TimeValueType.WORKERS_OLDEST },
          scenarioState
        );

        expect(start).toBe('2023-12-25T00:00:00.000Z');
        expect(end).toBe('2024-01-01T00:00:00.000Z');
      });

      it('Reconciliation: ABSOLUTE_TIME start, ABSOLUTE_TIME end', () => {
        const start = resolveTimeValue(
          { type: TimeValueType.ABSOLUTE_TIME, value: '2026-01-01T00:00:00Z' },
          scenarioState
        );
        const end = resolveTimeValue(
          { type: TimeValueType.ABSOLUTE_TIME, value: '2026-03-31T23:59:59Z' },
          scenarioState
        );

        expect(start).toBe('2026-01-01T00:00:00.000Z');
        expect(end).toBe('2026-03-31T23:59:59.000Z');
      });
    });
  });
});
