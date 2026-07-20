import { AirdropEvent } from '../types/extraction';

/**
 * PLATFORM CHECK REQUIRED (ISS-338642): gates all field-level-merge behavior
 * added for ENH-7536. `event_context.field_level_merge_enabled` is an
 * SDK-local placeholder field (see src/types/extraction.ts) that does not
 * exist on the real event context sent by the platform today. The real flag
 * is evaluated server-side inside airdrop-record-manager as
 * `airdrop.field_level_merging_primary` (per dev_org + external_system_name;
 * see internal/flags/flags.go in devrev/airdrop-record-manager), and that
 * per-system decision is not currently surfaced to snap-ins. Until the
 * platform team defines how the SDK should learn this, this flag defaults to
 * false for every real connector, so all Phase 3 hook points stay inert
 * (today's whole-object behavior) until wired up intentionally in tests.
 */
export function isFieldLevelMergeEnabled(event: AirdropEvent): boolean {
  return Boolean(event.payload.event_context.field_level_merge_enabled);
}

/**
 * PLATFORM CHECK REQUIRED (ISS-297298): placeholder read of which system is
 * authoritative for field-level conflict resolution on this sync. Mirrors
 * the backend's FieldMergingPrimarySystem enum ("devrev" | "external") in
 * devrev/airdrop-record-manager internal/flags/flags.go, but that value is
 * evaluated server-side per external_system_name and is not returned to the
 * SDK today. `event_context.field_level_merge_primary_system` is an
 * SDK-local placeholder (see src/types/extraction.ts) - replace with the
 * real signal once platform confirms whether the SDK needs to know primacy
 * directly, versus letting the record-manager endpoints apply it internally.
 */
export function isDevRevPrimaryForFieldMerge(event: AirdropEvent): boolean {
  return (
    event.payload.event_context.field_level_merge_primary_system === 'devrev'
  );
}
