import { createMockEvent } from './test-utils';
import {
  isDevRevPrimaryForFieldMerge,
  isExternalPrimaryForFieldMerge,
  isFieldLevelMergeEnabled,
} from './feature-flags';

describe(isFieldLevelMergeEnabled.name, () => {
  it('returns false when field_level_merging_enabled is not set', () => {
    const event = createMockEvent();

    expect(isFieldLevelMergeEnabled(event)).toBe(false);
  });

  it('returns true when field_level_merging_enabled is set to true', () => {
    const event = createMockEvent(undefined, {
      payload: { event_context: { field_level_merging_enabled: true } },
    });

    expect(isFieldLevelMergeEnabled(event)).toBe(true);
  });

  it('returns false when field_level_merging_enabled is explicitly false', () => {
    const event = createMockEvent(undefined, {
      payload: { event_context: { field_level_merging_enabled: false } },
    });

    expect(isFieldLevelMergeEnabled(event)).toBe(false);
  });
});

describe(isDevRevPrimaryForFieldMerge.name, () => {
  it('returns false when field_level_merging_primary_system is not set', () => {
    const event = createMockEvent();

    expect(isDevRevPrimaryForFieldMerge(event)).toBe(false);
  });

  it('returns true when field_level_merging_primary_system is "devrev"', () => {
    const event = createMockEvent(undefined, {
      payload: {
        event_context: { field_level_merging_primary_system: 'devrev' },
      },
    });

    expect(isDevRevPrimaryForFieldMerge(event)).toBe(true);
  });

  it('returns false when field_level_merging_primary_system is "external"', () => {
    const event = createMockEvent(undefined, {
      payload: {
        event_context: { field_level_merging_primary_system: 'external' },
      },
    });

    expect(isDevRevPrimaryForFieldMerge(event)).toBe(false);
  });
});

describe(isExternalPrimaryForFieldMerge.name, () => {
  it('returns false when field_level_merging_primary_system is not set', () => {
    const event = createMockEvent();

    expect(isExternalPrimaryForFieldMerge(event)).toBe(false);
  });

  it('returns true when field_level_merging_primary_system is "external"', () => {
    const event = createMockEvent(undefined, {
      payload: {
        event_context: { field_level_merging_primary_system: 'external' },
      },
    });

    expect(isExternalPrimaryForFieldMerge(event)).toBe(true);
  });

  it('returns false when field_level_merging_primary_system is "devrev"', () => {
    const event = createMockEvent(undefined, {
      payload: {
        event_context: { field_level_merging_primary_system: 'devrev' },
      },
    });

    expect(isExternalPrimaryForFieldMerge(event)).toBe(false);
  });
});
