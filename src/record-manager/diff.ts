import { NormalizedItem } from '../repo/repo.interfaces';

/**
 * FieldDelta represents only the fields of a NormalizedItem that have changed,
 * keeping the top-level identity/date fields so it can flow through the same
 * pipeline (e.g. Repo.upload's date-range tracking) as a full NormalizedItem.
 */
export interface FieldDelta {
  id: string;
  created_date: string;
  modified_date: string;
  data: Record<string, unknown>;
}

function isDeepEqual(a: unknown, b: unknown): boolean {
  if (a === b) {
    return true;
  }

  if (
    typeof a !== 'object' ||
    typeof b !== 'object' ||
    a === null ||
    b === null
  ) {
    return false;
  }

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) {
      return false;
    }
    return a.every((value, index) => isDeepEqual(value, b[index]));
  }

  const aKeys = Object.keys(a as Record<string, unknown>);
  const bKeys = Object.keys(b as Record<string, unknown>);
  if (aKeys.length !== bKeys.length) {
    return false;
  }

  return aKeys.every((key) =>
    isDeepEqual(
      (a as Record<string, unknown>)[key],
      (b as Record<string, unknown>)[key]
    )
  );
}

/**
 * Computes the field-level delta of curr relative to prev: fields present in
 * curr.data whose value differs from (or is absent from) prev.data.
 *
 * When prev is undefined (first sync), every field in curr.data is considered
 * changed.
 */
export function diffNormalizedObjects(
  curr: NormalizedItem,
  prev?: NormalizedItem
): FieldDelta {
  const currData = curr.data as Record<string, unknown>;
  const prevData = (prev?.data as Record<string, unknown>) || {};

  const data: Record<string, unknown> = {};
  for (const key of Object.keys(currData)) {
    if (!isDeepEqual(currData[key], prevData[key])) {
      data[key] = currData[key];
    }
  }

  return {
    id: curr.id,
    created_date: curr.created_date,
    modified_date: curr.modified_date,
    data,
  };
}

/**
 * Computes Changes = State − seen[0] − seen[1] − ...: strips any field from
 * state.data whose value matches the same field in ANY of the passed
 * snapshots. Used to remove both the last-seen state and any in-flight
 * loader attempts/fallbacks from a freshly extracted object, per the
 * ExternalExtractorSeen / ExternalLoaderAttempt subtraction formula.
 */
export function subtractSnapshots(
  state: NormalizedItem,
  ...seen: (NormalizedItem | undefined)[]
): FieldDelta {
  const stateData = state.data as Record<string, unknown>;
  const snapshots = seen
    .filter((snapshot): snapshot is NormalizedItem => snapshot !== undefined)
    .map((snapshot) => snapshot.data as Record<string, unknown>);

  const data: Record<string, unknown> = {};
  for (const key of Object.keys(stateData)) {
    const matchesAnySnapshot = snapshots.some((snapshotData) =>
      isDeepEqual(stateData[key], snapshotData[key])
    );
    if (!matchesAnySnapshot) {
      data[key] = stateData[key];
    }
  }

  return {
    id: state.id,
    created_date: state.created_date,
    modified_date: state.modified_date,
    data,
  };
}
