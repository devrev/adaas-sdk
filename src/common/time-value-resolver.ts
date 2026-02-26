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
 * Subtracts a shorthand duration from a base ISO 8601 timestamp.
 *
 * @param baseTimestamp - ISO 8601 timestamp to subtract from
 * @param duration - Shorthand duration string (e.g. '7d', '2m', '1y')
 * @returns ISO 8601 timestamp with the duration subtracted
 */
export function subtractDuration(
  baseTimestamp: string,
  duration: string
): string {
  const { value, unit } = parseDuration(duration);
  const date = new Date(baseTimestamp);

  switch (unit) {
    case 'd':
      date.setUTCDate(date.getUTCDate() - value);
      break;
    case 'm':
      date.setUTCMonth(date.getUTCMonth() - value);
      break;
    case 'y':
      date.setUTCFullYear(date.getUTCFullYear() - value);
      break;
  }

  return date.toISOString();
}

/**
 * Adds a shorthand duration to a base ISO 8601 timestamp.
 *
 * @param baseTimestamp - ISO 8601 timestamp to add to
 * @param duration - Shorthand duration string (e.g. '7d', '2m', '1y')
 * @returns ISO 8601 timestamp with the duration added
 */
export function addDuration(baseTimestamp: string, duration: string): string {
  const { value, unit } = parseDuration(duration);
  const date = new Date(baseTimestamp);

  switch (unit) {
    case 'd':
      date.setUTCDate(date.getUTCDate() + value);
      break;
    case 'm':
      date.setUTCMonth(date.getUTCMonth() + value);
      break;
    case 'y':
      date.setUTCFullYear(date.getUTCFullYear() + value);
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
 * - WORKERS_OLDEST: Returns workers_oldest from state
 * - WORKERS_NEWEST: Returns workers_newest from state
 * - WORKERS_OLDEST_MINUS_WINDOW: Subtracts duration from workers_oldest
 * - WORKERS_NEWEST_PLUS_WINDOW: Adds duration to workers_newest
 *
 * @param timeValue - The TimeValue to resolve
 * @param state - The current SDK state containing workers_oldest and workers_newest
 * @returns Resolved ISO 8601 timestamp string, or undefined for UNBOUNDED
 * @throws Error if required state values or TimeValue.value are missing
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
        throw new Error(
          'Cannot resolve WORKERS_OLDEST: workers_oldest is not set in state.'
        );
      }
      return state.workers_oldest;
    }

    case TimeValueType.WORKERS_NEWEST: {
      if (!state.workers_newest) {
        throw new Error(
          'Cannot resolve WORKERS_NEWEST: workers_newest is not set in state.'
        );
      }
      return state.workers_newest;
    }

    case TimeValueType.WORKERS_OLDEST_MINUS_WINDOW: {
      if (!state.workers_oldest) {
        throw new Error(
          'Cannot resolve WORKERS_OLDEST_MINUS_WINDOW: workers_oldest is not set in state.'
        );
      }
      if (!timeValue.value) {
        throw new Error(
          "TimeValue of type WORKERS_OLDEST_MINUS_WINDOW must have a value (duration, e.g. '7d', '2m')."
        );
      }
      return subtractDuration(state.workers_oldest, timeValue.value);
    }

    case TimeValueType.WORKERS_NEWEST_PLUS_WINDOW: {
      if (!state.workers_newest) {
        throw new Error(
          'Cannot resolve WORKERS_NEWEST_PLUS_WINDOW: workers_newest is not set in state.'
        );
      }
      if (!timeValue.value) {
        throw new Error(
          "TimeValue of type WORKERS_NEWEST_PLUS_WINDOW must have a value (duration, e.g. '7d', '2m')."
        );
      }
      return addDuration(state.workers_newest, timeValue.value);
    }

    default: {
      throw new Error(`Unknown TimeValueType: '${timeValue.type}'.`);
    }
  }
}
