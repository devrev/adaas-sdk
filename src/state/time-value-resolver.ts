import { UNBOUNDED_DATE_TIME_VALUE } from '../common/constants';
import { SdkState } from '../state/state.interfaces';
import { TimeUnit, TimeValue, TimeValueType } from '../types/extraction';

/** Parses a shorthand duration (e.g. '100ns', '500ms', '5m', '2h'); units are the `TimeUnit` values. */
export function parseDuration(shorthand: string): {
  value: number;
  unit: TimeUnit;
} {
  const validUnits = Object.values(TimeUnit).join('|');
  const match = shorthand.match(
    new RegExp(`^(\\d+(?:\\.\\d+)?)(${validUnits})$`)
  );
  if (!match) {
    throw new Error(
      `Invalid duration format: '${shorthand}'. Expected format like '100ns', '500ms', '30s', '5m', or '2h'.`
    );
  }
  return {
    value: parseFloat(match[1]),
    unit: match[2] as TimeUnit,
  };
}

/** Adds/subtracts a shorthand duration to/from an ISO 8601 timestamp. */
export function applyDuration(
  baseTimestamp: string,
  duration: string,
  operation: 'add' | 'subtract'
): string {
  const { value, unit } = parseDuration(duration);
  const date = new Date(baseTimestamp);
  const sign = operation === 'add' ? 1 : -1;

  switch (unit) {
    case TimeUnit.NANOSECONDS:
      // JavaScript Date works in milliseconds, so convert nanoseconds
      date.setTime(date.getTime() + sign * value * 0.000001);
      break;
    case TimeUnit.MICROSECONDS:
    case TimeUnit.MICROSECONDS_MU:
      date.setTime(date.getTime() + sign * value * 0.001);
      break;
    case TimeUnit.MILLISECONDS:
      date.setTime(date.getTime() + sign * value);
      break;
    case TimeUnit.SECONDS:
      date.setUTCSeconds(date.getUTCSeconds() + sign * value);
      break;
    case TimeUnit.MINUTES:
      date.setUTCMinutes(date.getUTCMinutes() + sign * value);
      break;
    case TimeUnit.HOURS:
      date.setUTCHours(date.getUTCHours() + sign * value);
      break;
  }

  return date.toISOString();
}

/**
 * Resolves a TimeValue into a concrete ISO 8601 timestamp. WORKERS_* types
 * read the boundaries from state and fall back to UNBOUNDED when unset
 * (backwards compatibility with old state); *_WINDOW types apply the duration
 * in `timeValue.value` to the boundary.
 */
export function resolveTimeValue(
  timeValue: TimeValue,
  state: SdkState
): string {
  switch (timeValue.type) {
    case TimeValueType.ABSOLUTE_TIME: {
      if (!timeValue.value) {
        throw new Error(
          'TimeValue of type ABSOLUTE must have a value (ISO 8601 timestamp).'
        );
      }
      // Normalize to consistent ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
      // to ensure string comparisons in boundary expansion are safe.
      const parsed = new Date(timeValue.value);
      if (isNaN(parsed.getTime())) {
        throw new Error(
          `TimeValue of type ABSOLUTE has an invalid ISO 8601 timestamp: '${timeValue.value}'.`
        );
      }
      return parsed.toISOString();
    }

    case TimeValueType.CURRENT_TIME: {
      return new Date().toISOString();
    }

    case TimeValueType.UNBOUNDED: {
      return UNBOUNDED_DATE_TIME_VALUE;
    }

    case TimeValueType.WORKERS_OLDEST: {
      if (!state.workersOldest) {
        return UNBOUNDED_DATE_TIME_VALUE;
      }
      return state.workersOldest;
    }

    case TimeValueType.WORKERS_NEWEST: {
      if (!state.workersNewest) {
        return UNBOUNDED_DATE_TIME_VALUE;
      }
      return state.workersNewest;
    }

    case TimeValueType.WORKERS_OLDEST_MINUS_WINDOW: {
      if (!timeValue.value) {
        throw new Error(
          "TimeValue of type WORKERS_OLDEST_MINUS_WINDOW must have a value (duration, e.g. '30s', '5m', '2h')."
        );
      }
      if (!state.workersOldest) {
        return UNBOUNDED_DATE_TIME_VALUE;
      }
      return applyDuration(state.workersOldest, timeValue.value, 'subtract');
    }

    case TimeValueType.WORKERS_NEWEST_PLUS_WINDOW: {
      if (!timeValue.value) {
        throw new Error(
          "TimeValue of type WORKERS_NEWEST_PLUS_WINDOW must have a value (duration, e.g. '30s', '5m', '2h')."
        );
      }
      if (!state.workersNewest) {
        return UNBOUNDED_DATE_TIME_VALUE;
      }
      return applyDuration(state.workersNewest, timeValue.value, 'add');
    }

    default: {
      throw new Error(`Unknown TimeValueType: '${timeValue.type}'.`);
    }
  }
}
