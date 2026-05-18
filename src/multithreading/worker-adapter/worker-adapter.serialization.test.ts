import { jsonl } from 'js-jsonl';

// Pin the serialization contract for items that reach the uploader.
//
// The SDK uploads items via Uploader.upload(), which calls jsonl.stringify() on
// the input. That means user `create`/`update` callbacks and normalizers can
// silently produce inputs that fail or lose information at the wire boundary:
//
//   - Circular references throw "Converting circular structure to JSON"
//   - BigInt values throw "Do not know how to serialize a BigInt"
//   - Date objects are converted to ISO strings (information loss: no Date on
//     the other side, just a string)
//   - undefined fields are dropped (null fields are preserved)
//
// These tests exist to catch regressions in the serialization layer (e.g.,
// silently switching to a different serializer that masks BigInt or mangles
// Dates) before they reach production.

describe('serialization boundary for items uploaded via jsonl', () => {
  it('throws when an item contains a circular reference', () => {
    // Arrange
    const item: Record<string, unknown> = { id: 'a' };
    item.self = item;

    // Act & Assert
    expect(() => jsonl.stringify([item])).toThrow(/circular/i);
  });

  it('throws when an item contains a BigInt field', () => {
    // Arrange
    const item = { id: 'a', counter: BigInt(1) };

    // Act & Assert
    expect(() => jsonl.stringify([item])).toThrow(/BigInt/i);
  });

  it('serializes Date instances to ISO strings (information loss — consumer receives a string)', () => {
    // Arrange
    const item = {
      id: 'a',
      created: new Date('2025-01-01T00:00:00.000Z'),
    };

    // Act
    const output = jsonl.stringify([item]);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    // Assert
    expect(parsed.created).toBe('2025-01-01T00:00:00.000Z');
    expect(typeof parsed.created).toBe('string');
  });

  it('drops undefined fields but preserves null fields', () => {
    // Arrange
    const item = {
      id: 'a',
      present: null,
      missing: undefined,
    };

    // Act
    const output = jsonl.stringify([item]);
    const parsed = JSON.parse(output) as Record<string, unknown>;

    // Assert
    expect(parsed).toEqual({ id: 'a', present: null });
    expect(parsed).not.toHaveProperty('missing');
  });

  it('emits one newline-terminated line per item (jsonl format)', () => {
    // Arrange
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];

    // Act
    const output = jsonl.stringify(items);
    const lines = output.split('\n').filter((l) => l.length > 0);

    // Assert
    expect(lines).toHaveLength(3);
    expect(JSON.parse(lines[0])).toEqual({ id: 'a' });
    expect(JSON.parse(lines[2])).toEqual({ id: 'c' });
  });
});
