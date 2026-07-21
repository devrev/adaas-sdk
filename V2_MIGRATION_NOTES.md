# v2 migration — engineering notes

Working notes behind the v1 (`@devrev/ts-adaas`) → v2 (`@devrev/airsync-sdk`) release: a
regression audit of the refactor, two forward-ported fixes, known inaccuracies in
[`MIGRATION.md`](./MIGRATION.md), and open items to resolve before GA. `MIGRATION.md` remains
the connector-facing guide; this file is the internal record.

## Regression audit summary

The refactor was audited area-by-area against the v1 source (branch `main`), comparing runtime
behavior rather than trusting the (rewritten) v2 test suite. **The intended breaking changes are
implemented correctly and are behaviorally equivalent to v1** — the status→event mapping, state
envelope + v1→v2 auto-migration, adapter split, incremental-window resolution, loader/attachment
`TaskResult` contract, attachment dedup, enum string values, internal axios client, worker-path
resolution, and the public barrel all verified equivalent.

The one real class of regression came from a **forward-port gap** (see below), not from the
refactor itself. A handful of `MIGRATION.md` doc inaccuracies were also found (see below).

## Forward-ported fixes (#210, #222)

The v2 branch was cut from `main` at `9a16ab2`, and its "merge main into v2" commit merged that
same commit into itself — a no-op that brought nothing new. Two fixes that landed on `main`
afterward were therefore missing from v2 and have now been forward-ported (commit `ad54ab2`):

- **#210** (`b9cef1f`, "add timestamps to artifacts and worker_metadata") — v2 had been emitting a
  shrunken `worker_metadata` (only `adaas_library_version`) and artifacts with no date fields. The
  refactor rebuilt the very files #210 touched, so the feature was lost in the rebuild. Re-applied
  onto the new architecture: `newest_state_date`/`oldest_state_date` live in `multithreading/emit.ts`
  (was `control-protocol.ts`); the per-item-type `item_type` + created/modified date ranges move to a
  new `buildWorkerMetadata()` template hook on `ExtractionAdapter` (was inline in `worker-adapter.emit`);
  `repo.ts` tracks `dateRanges`; the uploader spreads `computeArtifactDateRanges` into each `Artifact`.
- **#222** (`c1adc61`, "reduce retries for ERRCONNABORTED") — v2 lacked the `retries: 0` guard on
  guessed-`Content-Length` attachment uploads, re-introducing the ECONNABORTED retry storm. Restored in
  `uploader.ts`.

The port was verified byte-equivalent to the originals (including emit-template call ordering and the
`worker_metadata` spread precedence), and the accompanying tests that map onto surviving v2 files were
ported (`repo.helpers`, `computeArtifactDateRanges`, the `streamArtifact` retry cases). Build, lint, and
the full suite (442 tests) pass.

## Known inaccuracies in MIGRATION.md (trust the code over the doc)

1. **§12 — `LoaderEventType.UnknownEventType` does NOT survive.** MIGRATION.md (around L668–675)
   tells connectors to "switch to `LoaderEventType.UnknownEventType`", but that member was removed in
   v2 (replaced by an un-exported constant). A connector matching on it should compare against the raw
   string `'UNKNOWN_EVENT_TYPE'` (value unchanged; wire is unaffected).
2. **§8 — the `lastSyncStarted`/`lastSuccessfulSyncStarted` "no longer persisted" claim is imprecise.**
   They are no longer *read* or *set*, but the v1-blob migration still routes those legacy keys into
   `sdkState` and re-persists them (they are simply never used). Harmless, but the wording overstates it.
3. **Headline "byte-for-byte identical" (L7–11)** was false *relative to current `main`* until #210/#222
   were forward-ported (above). With the port in place it holds again.

## Open items (before GA)

- **Incoming legacy event-type routing.** v1's `translateIncomingEventType` was not an identity — it
  mapped legacy platform strings (e.g. `EXTRACTION_DATA_START`) onto the modern enum members. v2 removed
  translation and assumes the platform sends only modern strings. This is safe **iff** the platform no
  longer emits any legacy event-type string for any snap-in — worth confirming with the backend team
  before GA. Outgoing event-type resolution was verified equivalent.

## Connector migration skill

A fully-autonomous v1→v2 connector migration skill lives at [`skills/migrate-v2/`](./skills/migrate-v2/)
(`SKILL.md` + `references/transform-catalog.md` + `references/symbol-map.md`). It covers all 16
breaking-change categories and was validated by tracing the 5 reference connectors (asana, confluence,
hubspot, google-drive, google-calendar). It mirrors the `update-sdk` skill's format and is intended to
be ported to the `connector-dev` plugin. The trickiest findings it encodes:

- Detect-greps must target the **new** `@devrev/airsync-sdk` specifier (the package rename runs first).
- **State-cursor decision rule:** if `lastSuccessfulSyncStarted`/`lastSyncStarted` is declared in the
  connector's own `State` interface → rename it off the reserved SDK key; if it is only accessed loosely
  on `adapter.state` (SDK-supplied via v1 `AdapterState`) → delete the write / repoint the read to
  `event_context.extract_from`. Getting this backwards compiles but silently breaks incremental sync.
- `serializeAxiosError` is conditional: it still exists internally (returns an object) but is off the
  root barrel — keep it via a deep import where the result is object-spread; swap to `serializeError`
  (a string) only where used as a string.
