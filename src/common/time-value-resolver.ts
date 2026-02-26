import { TimeValue, TimeValueType } from '../types/extraction';
import { SdkState } from '../state/state.interfaces';

/**
 * Parses a shorthand duration string (e.g. '7d', '2m', '1y') into its numeric value and unit.
 * Supported units:
 * - 'd' for days
 * - 'm' for months
 * - 'y' for years
 *
 * @throws Error if the format is invalid
 */
export function parseDuration(shorthand: string): {
  value: number;
  unit: string;
} {
  const match = shorthand.match(/^(\d+)([dmy])$/);
  if (!match) {
    throw new Error(
      `Invalid duration format: '${shorthand}'. Expected format like '7d', '2m', or '1y'.`
    );
  }

  return {
    value: parseInt(match[1], 10),
    unit: match[2],
  };
}

/**
 * Applies a shorthand duration to a base ISO 8601 timestamp.
 *
 * @param baseTimestamp - ISO 8601 timestamp to apply duration to
 * @param duration - Shorthand duration string (e.g. '7d', '2m', '1y')
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
    case 'd':
      date.setUTCDate(date.getUTCDate() + sign * value);
      break;
    case 'm':
      date.setUTCMonth(date.getUTCMonth() + sign * value);
      break;
    case 'y':
      date.setUTCFullYear(date.getUTCFullYear() + sign * value);
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
 * - UNBOUNDED: Returns undefined (no bound)
 * - WORKERS_OLDEST: Returns workers_oldest from state, or current time if not set
 * - WORKERS_NEWEST: Returns workers_newest from state, or current time if not set
 * - WORKERS_OLDEST_MINUS_WINDOW: Subtracts duration from workers_oldest (or current time if not set)
 * - WORKERS_NEWEST_PLUS_WINDOW: Adds duration to workers_newest (or current time if not set)
 *
 * @param timeValue - The TimeValue to resolve
 * @param state - The current SDK state containing workers_oldest and workers_newest
 * @returns Resolved ISO 8601 timestamp string, or undefined for UNBOUNDED
 * @throws Error if required TimeValue.value is missing for ABSOLUTE or *_WINDOW types
 */
export function resolveTimeValue(
  timeValue: TimeValue,
  state: SdkState
): string | undefined {
  switch (timeValue.type) {
    case TimeValueType.ABSOLUTE: {
      if (!timeValue.value) {
        throw new Error(
          'TimeValue of type ABSOLUTE must have a value (ISO 8601 timestamp).'
        );
      }
      return timeValue.value;
    }

    case TimeValueType.NOW: {
      return new Date().toISOString();
    }

    case TimeValueType.UNBOUNDED: {
      return undefined;
    }

    case TimeValueType.WORKERS_OLDEST: {
      if (!state.workers_oldest) {
        console.log(
          'workers_oldest not set in state, falling back to current time.'
        );
        return new Date().toISOString();
      }
      return state.workers_oldest;
    }

    case TimeValueType.WORKERS_NEWEST: {
      if (!state.workers_newest) {
        console.log(
          'workers_newest not set in state, falling back to current time.'
        );
        return new Date().toISOString();
      }
      return state.workers_newest;
    }

    case TimeValueType.WORKERS_OLDEST_MINUS_WINDOW: {
      if (!timeValue.value) {
        throw new Error(
          "TimeValue of type WORKERS_OLDEST_MINUS_WINDOW must have a value (duration, e.g. '7d', '2m')."
        );
      }
      const base = state.workers_oldest || new Date().toISOString();
      if (!state.workers_oldest) {
        console.log(
          'workers_oldest not set in state, falling back to current time for WORKERS_OLDEST_MINUS_WINDOW.'
        );
      }
      return applyDuration(base, timeValue.value, 'subtract');
    }

    case TimeValueType.WORKERS_NEWEST_PLUS_WINDOW: {
      if (!timeValue.value) {
        throw new Error(
          "TimeValue of type WORKERS_NEWEST_PLUS_WINDOW must have a value (duration, e.g. '7d', '2m')."
        );
      }
      const base = state.workers_newest || new Date().toISOString();
      if (!state.workers_newest) {
        console.log(
          'workers_newest not set in state, falling back to current time for WORKERS_NEWEST_PLUS_WINDOW.'
        );
      }
      return applyDuration(base, timeValue.value, 'add');
    }

    default: {
      throw new Error(`Unknown TimeValueType: '${timeValue.type}'.`);
    }
  }
}
