import { toValidTimestamp, updateRange } from './repo.helpers';

describe(updateRange.name, () => {
  it('should set both oldest and newest from the first value', () => {
    const range: { oldest?: number; newest?: number } = {};

    updateRange(range, 1000);

    expect(range).toEqual({ oldest: 1000, newest: 1000 });
  });

  it('should expand oldest when a smaller value is seen', () => {
    const range: { oldest?: number; newest?: number } = {
      oldest: 1000,
      newest: 1000,
    };

    updateRange(range, 500);

    expect(range).toEqual({ oldest: 500, newest: 1000 });
  });

  it('should expand newest when a larger value is seen', () => {
    const range: { oldest?: number; newest?: number } = {
      oldest: 1000,
      newest: 1000,
    };

    updateRange(range, 1500);

    expect(range).toEqual({ oldest: 1000, newest: 1500 });
  });

  it('should not change bounds when the value is within range', () => {
    const range: { oldest?: number; newest?: number } = {
      oldest: 1000,
      newest: 2000,
    };

    updateRange(range, 1500);

    expect(range).toEqual({ oldest: 1000, newest: 2000 });
  });

  it('[edge] should track a value of 0 (Unix epoch) instead of treating it as unset', () => {
    const range: { oldest?: number; newest?: number } = {};

    updateRange(range, 0);

    expect(range).toEqual({ oldest: 0, newest: 0 });
  });

  it('[edge] should not let a later 0 value overwrite an already-set range incorrectly', () => {
    const range: { oldest?: number; newest?: number } = {
      oldest: 1000,
      newest: 2000,
    };

    updateRange(range, 0);

    expect(range).toEqual({ oldest: 0, newest: 2000 });
  });

  it('[edge] should handle negative timestamps (pre-1970 dates)', () => {
    const range: { oldest?: number; newest?: number } = {};

    updateRange(range, -1000);
    updateRange(range, 500);

    expect(range).toEqual({ oldest: -1000, newest: 500 });
  });
});

describe(toValidTimestamp.name, () => {
  it('should convert a valid RFC3339 string to milliseconds', () => {
    const result = toValidTimestamp('2023-06-15T12:00:00.000Z');

    expect(result).toBe(new Date('2023-06-15T12:00:00.000Z').getTime());
  });

  it('[edge] should return 0 for the Unix epoch instead of undefined', () => {
    const result = toValidTimestamp('1970-01-01T00:00:00.000Z');

    expect(result).toBe(0);
  });

  it('[edge] should return undefined for an invalid date string', () => {
    const result = toValidTimestamp('not-a-date');

    expect(result).toBeUndefined();
  });

  it('[edge] should return undefined for an empty string', () => {
    const result = toValidTimestamp('');

    expect(result).toBeUndefined();
  });
});
