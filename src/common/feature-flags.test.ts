import { createMockEvent } from './test-utils';
import {
  isDevRevPrimaryForFieldMerge,
  isFieldLevelMergeEnabled,
} from './feature-flags';

describe(isFieldLevelMergeEnabled.name, () => {
  it('returns false when field_level_merge_enabled is not set', () => {
    const event = createMockEvent();

    expect(isFieldLevelMergeEnabled(event)).toBe(false);
  });

  it('returns true when field_level_merge_enabled is set to true', () => {
    const event = createMockEvent(undefined, {
      payload: { event_context: { field_level_merge_enabled: true } },
    });

    expect(isFieldLevelMergeEnabled(event)).toBe(true);
  });

  it('returns false when field_level_merge_enabled is explicitly false', () => {
    const event = createMockEvent(undefined, {
      payload: { event_context: { field_level_merge_enabled: false } },
    });

    expect(isFieldLevelMergeEnabled(event)).toBe(false);
  });
});

describe(isDevRevPrimaryForFieldMerge.name, () => {
  it('returns false when field_level_merge_primary_system is not set', () => {
    const event = createMockEvent();

    expect(isDevRevPrimaryForFieldMerge(event)).toBe(false);
  });

  it('returns true when field_level_merge_primary_system is "devrev"', () => {
    const event = createMockEvent(undefined, {
      payload: {
        event_context: { field_level_merge_primary_system: 'devrev' },
      },
    });

    expect(isDevRevPrimaryForFieldMerge(event)).toBe(true);
  });

  it('returns false when field_level_merge_primary_system is "external"', () => {
    const event = createMockEvent(undefined, {
      payload: {
        event_context: { field_level_merge_primary_system: 'external' },
      },
    });

    expect(isDevRevPrimaryForFieldMerge(event)).toBe(false);
  });
});
