export function updateRange(
  range: { oldest: number; newest: number },
  ms: number
): void {
  if (range.oldest === 0 || ms < range.oldest) {
    range.oldest = ms;
  }
  if (range.newest === 0 || ms > range.newest) {
    range.newest = ms;
  }
}

export function toValidTimestamp(value: string): number | undefined {
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : undefined;
}

