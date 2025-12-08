import { ErrorRecord } from '../types/common';
import { EventData } from '../types/extraction';

// Max SQS message size is 250KB, we want to leave some room for the other data in the message
const MAX_EVENT_SIZE_BYTES = 200_000;
// We want to leave some room for the other data in the message and process the rest of queued messages
const EVENT_SIZE_THRESHOLD_BYTES = Math.floor(MAX_EVENT_SIZE_BYTES * 0.8);

export { EVENT_SIZE_THRESHOLD_BYTES, MAX_EVENT_SIZE_BYTES };

/**
 * Truncate error message to max length (default 1000 chars)
 */
export function truncateErrorMessage(
  error: ErrorRecord | undefined,
  maxLength: number = 1000
): ErrorRecord | undefined {
  if (!error) return undefined;

  return {
    message: error.message?.substring(0, maxLength) ?? '',
  };
}

/**
 * Prune event data by truncating error messages
 * Always applied before serialization
 */
export function pruneEventData(
  data: EventData | undefined
): EventData | undefined {
  if (!data) return data;

  return {
    ...data,
    error: truncateErrorMessage(data.error),
  };
}
