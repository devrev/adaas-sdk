import { NormalizedItem } from '../repo/repo.interfaces';
import { diffNormalizedObjects, subtractSnapshots } from './diff';

function item(data: Record<string, unknown>): NormalizedItem {
  return {
    id: 'item_1',
    created_date: '2026-01-01T00:00:00.000Z',
    modified_date: '2026-01-02T00:00:00.000Z',
    data,
  };
}

describe(diffNormalizedObjects.name, () => {
  it('treats every field as changed when there is no previous snapshot', () => {
    const curr = item({ name: 'Alice', status: 'open' });

    const delta = diffNormalizedObjects(curr);

    expect(delta.data).toEqual({ name: 'Alice', status: 'open' });
    expect(delta.id).toBe(curr.id);
    expect(delta.created_date).toBe(curr.created_date);
    expect(delta.modified_date).toBe(curr.modified_date);
  });

  it('returns an empty delta for identical objects', () => {
    const curr = item({ name: 'Alice', status: 'open' });
    const prev = item({ name: 'Alice', status: 'open' });

    const delta = diffNormalizedObjects(curr, prev);

    expect(delta.data).toEqual({});
  });

  it('detects a single changed field', () => {
    const curr = item({ name: 'Alice', status: 'closed' });
    const prev = item({ name: 'Alice', status: 'open' });

    const delta = diffNormalizedObjects(curr, prev);

    expect(delta.data).toEqual({ status: 'closed' });
  });

  it('detects a changed nested object field', () => {
    const curr = item({ address: { city: 'Ljubljana', zip: '1000' } });
    const prev = item({ address: { city: 'Maribor', zip: '1000' } });

    const delta = diffNormalizedObjects(curr, prev);

    expect(delta.data).toEqual({
      address: { city: 'Ljubljana', zip: '1000' },
    });
  });

  it('detects a changed array field', () => {
    const curr = item({ tags: ['a', 'b'] });
    const prev = item({ tags: ['a'] });

    const delta = diffNormalizedObjects(curr, prev);

    expect(delta.data).toEqual({ tags: ['a', 'b'] });
  });

  it('includes a new field that has no prior snapshot value', () => {
    const curr = item({ name: 'Alice', status: 'open' });
    const prev = item({ name: 'Alice' });

    const delta = diffNormalizedObjects(curr, prev);

    expect(delta.data).toEqual({ status: 'open' });
  });
});

describe(subtractSnapshots.name, () => {
  it('strips fields that match a single snapshot', () => {
    const state = item({ name: 'Alice', status: 'open' });
    const seen = item({ name: 'Alice', status: 'closed' });

    const delta = subtractSnapshots(state, seen);

    expect(delta.data).toEqual({ status: 'open' });
  });

  it('strips fields that match any of multiple snapshots', () => {
    const state = item({ name: 'Alice', status: 'open', owner: 'bob' });
    const extractorSeen = item({
      name: 'Zoe',
      status: 'closed',
      owner: 'carol',
    });
    const loaderAttempt = item({ name: 'Yara', status: 'open', owner: 'bob' });

    const delta = subtractSnapshots(state, extractorSeen, loaderAttempt);

    // name differs from both, status matches loaderAttempt, owner matches extractorSeen
    expect(delta.data).toEqual({ name: 'Alice' });
  });

  it('keeps a field with no matching snapshot at all', () => {
    const state = item({ name: 'Alice' });

    const delta = subtractSnapshots(state, undefined, undefined);

    expect(delta.data).toEqual({ name: 'Alice' });
  });

  it('ignores undefined snapshots mixed with defined ones', () => {
    const state = item({ name: 'Alice', status: 'open' });
    const loaderAttempt = item({ name: 'Alice', status: 'closed' });

    const delta = subtractSnapshots(state, undefined, loaderAttempt);

    expect(delta.data).toEqual({ status: 'open' });
  });
});
