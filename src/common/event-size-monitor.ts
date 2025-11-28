import { ErrorRecord } from '../types/common';
import { EventData } from '../types/extraction';

const MAX_EVENT_SIZE_BYTES = 200_000;
const EVENT_SIZE_THRESHOLD_BYTES = Math.floor(MAX_EVENT_SIZE_BYTES * 0.8); // 160_000 bytes

/**
 * Get the JSON serialized size of event data in bytes
 */
export function getEventDataSize(data: EventData | undefined): number {
  if (!data) return 0;
  return JSON.stringify(data).length;
}

/**
 * Check if event data exceeds the 80% threshold (160KB)
 */
export function shouldTriggerSizeLimit(data: EventData | undefined): boolean {
  return getEventDataSize(data) > EVENT_SIZE_THRESHOLD_BYTES;
}

/**
 * Truncate error message to max length (default 1000 chars)
 */
export function truncateErrorMessage(
  error: ErrorRecord | undefined,
  maxLength: number = 1000
): ErrorRecord | undefined {
  if (!error) return undefined;

  return {
    message: error.message.substring(0, maxLength),
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

/**
 * Log detailed warning when size limit is detected
 */
export function logSizeLimitWarning(
  size: number,
  triggerType: 'onUpload' | 'onEmit'
): void {
  const percentage = (size / MAX_EVENT_SIZE_BYTES) * 100;
  const detailsString =
    triggerType === 'onUpload'
      ? 'during data collection. Emitting progress event and stopping further processing.'
      : 'during emit. Error messages truncated.';

  console.warn(
    `[SIZE_LIMIT] Event data size ${size} bytes (${percentage.toFixed(
      1
    )}% of ${MAX_EVENT_SIZE_BYTES} limit) detected ${detailsString}`
  );
}

export { MAX_EVENT_SIZE_BYTES as MAX_EVENT_SIZE, EVENT_SIZE_THRESHOLD_BYTES as SIZE_LIMIT_THRESHOLD };
