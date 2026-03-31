import { TimeUnit, TimeValue, TimeValueType } from '../types/extraction';
import { SdkState } from '../state/state.interfaces';
import { UNBOUNDED_DATE_TIME_VALUE } from './constants';

/**
 * Parses a shorthand duration string into its numeric value and unit.
 * Supported units:
 * - 'ns' for nanoseconds
 * - 'us' or 'µs' for microseconds
 * - 'ms' for milliseconds
 * - 's' for seconds
 * - 'm' for minutes
 * - 'h' for hours
 *
 * @throws Error if the format is invalid
 */
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

/**
 * Applies a shorthand duration to a base ISO 8601 timestamp.
 *
 * @param baseTimestamp - ISO 8601 timestamp to apply duration to
 * @param duration - Shorthand duration string (e.g. '100ns', '500ms', '30s', '5m', '2h')
 * @param operation - Whether to 'add' or 'subtract' the duration
 * @returns ISO 8601 timestamp with the duration applied
 */
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
 * Resolves a TimeValue into a concrete ISO 8601 timestamp string.
 *
 * Resolution rules:
 * - ABSOLUTE: Returns the value directly (must be an ISO 8601 timestamp)
 * - NOW: Returns the current time as ISO 8601
 * - UNBOUNDED: Returns UNBOUNDED_DATE_TIME_VALUE ('1970-01-01T00:00:00.000Z')
 * - WORKERS_OLDEST: Returns workers_oldest from state, or throws if not set
 * - WORKERS_NEWEST: Returns workers_newest from state, or throws if not set
 * - WORKERS_OLDEST_MINUS_WINDOW: Subtracts duration from workers_oldest, or throws if not set
 * - WORKERS_NEWEST_PLUS_WINDOW: Adds duration to workers_newest, or throws if not set
 *
 * @param timeValue - The TimeValue to resolve
 * @param state - The current SDK state containing workers_oldest and workers_newest
 * @returns Resolved ISO 8601 timestamp string
 * @throws Error if required TimeValue.value is missing for ABSOLUTE or *_WINDOW types
 * @throws Error if workers_oldest/workers_newest is not set in state for WORKERS_* types
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
        // To support backwards-compatibility for the old state
        return UNBOUNDED_DATE_TIME_VALUE;
      }
      return state.workersOldest;
    }

    case TimeValueType.WORKERS_NEWEST: {
      if (!state.workersNewest) {
        // To support backwards-compatibility for the old state
        if (state.lastSuccessfulSyncStarted) {
          return state.lastSuccessfulSyncStarted;
        }

        throw new Error(
          'Field workersNewest is not set in state. Cannot resolve TimeValue of type WORKERS_NEWEST without a prior extraction boundary.'
        );
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
        // To support backwards-compatibility for the old state
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
        // To support backwards-compatibility for the old state
        if (state.lastSuccessfulSyncStarted) {
          return state.lastSuccessfulSyncStarted;
        }

        throw new Error(
          'Field workersNewest is not set in state. Cannot resolve TimeValue of type WORKERS_NEWEST_PLUS_WINDOW without a prior extraction boundary.'
        );
      }
      return applyDuration(state.workersNewest, timeValue.value, 'add');
    }

    default: {
      throw new Error(`Unknown TimeValueType: '${timeValue.type}'.`);
    }
  }
}
