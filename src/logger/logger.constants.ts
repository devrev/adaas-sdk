import { InspectOptions } from 'node:util';

export const MAX_LOG_STRING_LENGTH = 10000;
export const MAX_LOG_DEPTH = 10;
export const MAX_LOG_ARRAY_LENGTH = 100;

export const INSPECT_OPTIONS: InspectOptions = {
  compact: false,
  breakLength: Infinity,
  depth: MAX_LOG_DEPTH,
  maxArrayLength: MAX_LOG_ARRAY_LENGTH,
  maxStringLength: MAX_LOG_STRING_LENGTH,
};
