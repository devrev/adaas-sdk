import { AirdropEvent } from '../types/extraction';

/**
 * Gates all field-level-merge behavior added for ENH-7536.
 * `event_context.field_level_merging_enabled` is resolved server-side per
 * dev-org + external-system-name from the `airdrop.field_level_merging_primary`
 * flag and inlined into the event context via `adaas.SyncRunContext`
 * (devrev/airdrop-snapin-manager PR #431, ASFND-299, merged). Unset/false for
 * every sync not covered by that flag, so all field-level-merge hook points
 * stay inert (today's whole-object behavior) until enabled for a given
 * external system.
 */
export function isFieldLevelMergeEnabled(event: AirdropEvent): boolean {
  return Boolean(event.payload.event_context.field_level_merging_enabled);
}

/**
 * Whether DevRev is the primary system for field-level conflict resolution
 * on this sync. Mirrors the backend's FieldMergingPrimarySystem enum
 * ("devrev" | "external") in devrev/airdrop-record-manager
 * internal/flags/flags.go, surfaced via
 * `event_context.field_level_merging_primary_system`
 * (devrev/airdrop-snapin-manager PR #431, ASFND-299, merged). Primacy is
 * scoped per external_system_name, globally - there is no per-object,
 * per-field, or per-recipe granularity in the current design.
 */
export function isDevRevPrimaryForFieldMerge(event: AirdropEvent): boolean {
  return (
    event.payload.event_context.field_level_merging_primary_system === 'devrev'
  );
}

/**
 * Whether the external system is primary for field-level conflict resolution
 * on this sync. Not simply `!isDevRevPrimaryForFieldMerge` - the flag can be
 * enabled for a sync while the primary system is unset (e.g. the external
 * system isn't mapped by `airdrop.field_level_merging_primary`), in which
 * case neither side should be treated as primary.
 */
export function isExternalPrimaryForFieldMerge(event: AirdropEvent): boolean {
  return (
    event.payload.event_context.field_level_merging_primary_system ===
    'external'
  );
}
