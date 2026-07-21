---
name: migrate-v2
description: Autonomously migrate a DevRev AirSync connector from SDK v1 (@devrev/ts-adaas, 1.19.x) to v2 (@devrev/airsync-sdk, 2.0.0). Applies every breaking-change transform end-to-end — package rename, deep-import repointing, AirdropEvent→AirSyncEvent, processTask split, emit()→return TaskResult, WorkerAdapter→Extraction/LoadingAdapter, ESU repo, onTimeout, mappers .data unwrap, adapter.state/sdkState split, incremental-window rewrite, axios removal, spawn workerPath, deleted enum members, and jest-mock rewrites — then runs tsc/lint/build/tests. Use whenever the user asks to "migrate to v2", "migrate to airsync-sdk", "upgrade connector to airsync sdk", "migrate ts-adaas to airsync-sdk", or do a "v1 to v2 migration".
---

# Migrate connector to AirSync SDK v2

Goal: end the session with the connector depending on `@devrev/airsync-sdk` `2.0.0` instead of `@devrev/ts-adaas`, all v1 API usage rewritten to the v2 API, the codebase passing `tsc --noEmit` / lint / build / tests, and every semantic (non-mechanical) rewrite recorded in `MIGRATION_REVIEW.md` for the developer to eyeball.

This is a **fully-autonomous, best-effort** migration. It attempts EVERY transform — including the hard semantic ones (emit→return, incremental-window, buried emits in shared helpers and class methods). It does not defer hard cases to a human; it makes its best judgment, applies the edit, and logs a review entry. It only stops if the checks cannot be made to pass after repeated attempts.

The wire protocol is UNCHANGED: every surviving enum string value is byte-identical v1→v2. This is purely a TypeScript-API migration. Do not touch runtime string values on the wire.

## Reference files (read these — they are the spec)

- `references/transform-catalog.md` — the full per-category recipe for all 16 breaking-change categories, with concrete before/after and pitfalls. **Read the category you are about to apply, every time** — the recipes encode gotchas found by validating against 5 real connectors.
- `references/symbol-map.md` — the exact disposition of every v1 symbol (kept / renamed / removed / now-root-import) and what to do with it.

The connector's `code/src` (or `src`) is the target. The SDK's own `MIGRATION.md` is background only — where it conflicts with the catalog, **trust the catalog** (it was audited against the v2 source; the guide has known doc bugs, e.g. it wrongly claims `LoaderEventType.UnknownEventType` survives).

## Success criteria

1. `package.json` no longer contains `@devrev/ts-adaas`; it contains `@devrev/airsync-sdk` at `2.0.0` (preserving the original range operator if any), and `npm install` has regenerated the lockfile.
2. No `@devrev/ts-adaas` string remains anywhere in source, tests, or config (imports, `jest.mock`, `jest.requireActual`, `moduleNameMapper`).
3. `cd <code> && npx tsc --noEmit` passes with zero errors. No `adapter.emit(...)` and no removed symbol remains — a compile error is never left unaddressed.
4. `cd <code> && npm run lint` passes. **This includes `noUnusedLocals`/`no-unused-vars`** — every import and local orphaned by a rewrite (dead dispatcher fns, unused `EventType` imports, dropped params) must be cleaned up, not just the direct edit.
5. `cd <code> && npm run build` passes.
6. If a test dir exists (`test/`, `**/__tests__/`, or co-located `*.test.ts`), the repo's test command passes (`npm test`, add `-- --coverage` only if that is the repo convention). **Test files are first-class migration targets, not an afterthought** — most gaps that survive tsc surface here.
7. Every semantic rewrite (anything from a `mechanical: false` category, plus every review trigger) is recorded in `MIGRATION_REVIEW.md` at the repo root with file, symbol, what changed, and confidence.

If all of 1–7 hold, you are done.

## Workflow

Work one category at a time, in this exact order (later categories depend on earlier ones). Within each category, grep the whole connector (source **and** tests) first, then edit every hit. Do not run the build until the whole batch is applied — a half-applied batch always fails to compile.

> **CRITICAL grep-ordering rule.** Step 1 (package-rename) globally replaces the string `@devrev/ts-adaas` → `@devrev/airsync-sdk` everywhere, INCLUDING inside `dist/**` deep-import paths (it is a substring replace). So after step 1, **no detect grep may search for the old `@devrev/ts-adaas` specifier** — it will return zero hits and the category will look like a false no-op. Every symbol/deep-path detect grep in the catalog is written to match the NEW specifier (`@devrev/airsync-sdk`) or a bare symbol name (e.g. `\baxios\b`, `axiosClient`, `serializeAxiosError`, `@devrev/airsync-sdk/dist`). Use those.

0. **Locate the connector root.** Find the dir containing `package.json` with `@devrev/ts-adaas` — usually `code/`, sometimes repo root. Confirm the SDK version is a `1.19.x` semver (not `workspace:`/`git+`/`file:`). If it already depends on `@devrev/airsync-sdk`, report "already on v2" and stop. Record `<code>` as that dir. Also note whether lint covers `test/**` and what `npm test` runs (unit only vs unit+integration) — you will need to migrate whatever the gates check.

1. **package-rename** (mechanical). Swap the dependency in `package.json` (`@devrev/ts-adaas` → `@devrev/airsync-sdk: 2.0.0`). Global-replace the specifier string `'@devrev/ts-adaas'` → `'@devrev/airsync-sdk'` in every import, every `jest.mock('...')` first arg, every `jest.requireActual('...')` arg, and any `moduleNameMapper`. This also rewrites deep-import path prefixes (handled next). Do NOT rename symbols yet.

2. **deep-imports** (mechanical). Detect with `grep -rnE "@devrev/airsync-sdk/dist" src test`. Repoint or drop every deep import per the catalog: `Item`, `ItemTypeToLoad`, `Mappers`, `InitialSyncScope` become ROOT imports; `serializeAxiosError` — see the CONDITIONAL rule in §14 (keep-via-deep-repoint if its result is spread/property-accessed as an object; swap to root `serializeError` only if used as a string); `ToDevRev` is DROPPED entirely; `mappers.interface` (singular) → `mappers.interfaces` (plural) only for the two `*Response` types genuinely not on the root barrel.

3. **event-type-rename** (mechanical). `AirdropEvent`→`AirSyncEvent`, `AirdropMessage`→`AirSyncMessage` in every annotation, generic, cast, `extends`. If a `CustomAirdropEvent` only added the identity fields now native on `AirSyncEvent.context` (`user_id`, `dev_oid`, `source_id`, `service_account_id`, **and `snap_in_id`** — all five), delete it and read `adapter.event.context.<field>`; if it added other fields, rebase it on `AirSyncEvent`. Do NOT mass-rename other `Airdrop*`/`Extractor*` type names.

4. **deleted-enum-members** (mechanical). Map deleted `EventType`/`ExtractorEventType`/`LoaderEventType` members to their surviving modern members; map any `*.UnknownEventType` to the raw string `'UNKNOWN_EVENT_TYPE'` (the member is gone — MIGRATION.md §12 is wrong); drop `translate*EventType`; `ExtractionMode`→`SyncMode`, `EventContextIn/Out`→`EventContext`. See the catalog table.

5. **adapter-split** (semantic). `WorkerAdapter<T>` annotations → `ExtractionAdapter<T>` (extraction-phase) or `LoadingAdapter<T>` (loading-phase); infer phase from directory/methods. Leave `WorkerAdapterInterface`/`WorkerAdapterOptions` alone. If an extraction-phase site uses `adapter.mappers`, construct `new Mappers({ event: adapter.event })` (hoist out of loops).

6. **process-task-split** (mechanical, paired with step 7). `processTask` → `processExtractionTask` (extraction workers) / `processLoadingTask` (loading workers) in import and call site; keep the `<State>` generic.

7. **emit-to-return** (semantic, the core change). Convert every `adapter.emit(...)` to a `return` of a `TaskResult` per the translation table. Watch `delay`→`delaySeconds`. Emits can live in three shapes: (a) directly in the task closure; (b) buried in a shared void/boolean helper → bubble a `TaskResult | null` up (or store `this.result`); (c) inside **class instance methods** with a boolean-abort protocol → see the catalog's class-method recipe. A `Done` carrying a non-fatal error summary → `return { status: 'success' }` and surface the error via a report/log (do NOT map to `error` status — that emits `*Error`).

8. **loader-method-return** (semantic). `loadItemTypes`/`loadAttachments`/`streamAttachments` RETURN a `TaskResult` (which has NO `reports`/`processed_files` — those flow automatically). Collapse the emit ladder to a pass-through `return adapter.loadItemTypes(...)`. If the connector destructures `{ reports, processed_files }` off the call or pushes a synthetic report, that is a tsc error in v2: push onto the live `adapter.reports` getter BEFORE the return instead.

9. **esu-repo** (semantic). Inline `emit({ external_sync_units })` → `initializeRepos([EXTERNAL_SYNC_UNITS ...])` + `getRepo(...).push(...)` + `return { status:'success' }`. A connector already pushing to the repo just needs its trailing emit converted.

10. **onTimeout** (semantic). Rewrite `onTimeout` to RETURN a `TaskResult`. Resumable phases → `{ status:'progress' }`. Non-resumable phases (ESU, metadata, state-deletion) → explicit `{ status:'error', error:{ message } }`. **Never omit an onTimeout whose body does real work** (e.g. `cancelRateLimiting()`, clearing `repo.uploadedArtifacts`) — preserve the body, replace only the emit. Drop `postState()`/`process.exit()`.

11. **mappers-unwrap** (semantic). Drop `.data` at mappers read sites AND drop the `data?:` wrapper in any hand-rolled structural param type. **Also unwrap the mapper TEST DOUBLES** — a `mockResolvedValue({ data: { sync_mapper_record ... } })` must become `{ sync_mapper_record ... }`, or the test silently reads undefined (these test files often import no SDK, so they slip past jest-mock detection).

12. **state-sdk-fields** (semantic, highest data-loss risk). Remove SDK-owned keys (`toDevRev`/`fromDevRev`/`workers*`/`snapInVersionId`) from the connector's State interface + `getInitialState`. Drop `AdapterState<S>` annotations — **replace with the connector's own State type** (do not just delete: as a param/field type `state?: AdapterState<S>` → `state?: <ConnectorState>`). For the `lastSyncStarted`/`lastSuccessfulSyncStarted` cursor fields, apply the **decision rule** below. Propagate every state-field rename and every `AdapterState` replacement into `test/**` fixtures too.

13. **incremental-window** (semantic). Governed by the decision rule below.

    > **DECISION RULE (resolves the confluence/hubspot split):** is the cursor field (`lastSuccessfulSyncStarted`/`lastSyncStarted`) declared in the connector's OWN `State` interface / `getInitialState`?
    > - **NO** — it is only accessed loosely on `adapter.state.<field>` but absent from the interface → it was SDK-supplied via v1 `AdapterState<T>` (removed in v2). **DELETE** a bare write; **repoint** a read to `adapter.event.payload.event_context.extract_from` (usually already destructured nearby for the initial-window filter). Do NOT rename — there is no field to preserve.
    > - **YES** — it is a connector-declared home-grown cursor (written and read by connector code, often distinct from `extract_from` which the connector consumes separately) → **RENAME** it off the reserved SDK key (e.g. `lastSuccessfulSyncStarted` → `lastSuccessfulWindowStart`) throughout the interface, `getInitialState`, all read/write sites, and test fixtures. Renaming preserves the mechanism; substituting `extract_from` here would destroy the cursor. (The reserved key must be renamed because v2's v1-blob auto-migration strips it.)

14. **axios-removal** (semantic). `import { axios }` → `import axios from 'axios'` (preserving any co-imported root symbols like `ErrorRecord`/`EventType`/`SyncMode` as a named import from `@devrev/airsync-sdk`). `import { axiosClient }` → construct a local `axios.create()` + `axiosRetry(...)` named `axiosClient`. **`serializeAxiosError` is CONDITIONAL:** if its result is spread/property-accessed as an object, KEEP it via `import { serializeAxiosError } from '@devrev/airsync-sdk/dist/logger/logger'` (it still exists internally, returns an object); only swap to root `serializeError` where the result is used as a string. `formatAxiosError` → `serializeError`. Add `axios`/`axios-retry` to deps if missing.

15. **spawn-workerpath** (mechanical → sometimes semantic). `workerPath: __dirname + '/workers/<phase>'` → `baseWorkerPath: __dirname`. If `workerPath` is fed by a variable/dispatcher (`workerPath: file` where `file` comes from a `switch` helper), also DELETE the now-dead dispatcher fn, its locals, and any orphaned imports (`EventType`, etc.) or you break `noUnusedLocals`/lint. Leave `workerPathOverrides` alone.

16. **jest-mocks** (semantic). Mechanical part: rename specifier + `processTask`→split + drop `WorkerAdapter:{}`/`axiosClient:{}` mock keys + `AirdropEvent`→`AirSyncEvent`. Semantic part: rewrite `expect(adapter.emit).toHaveBeenCalledWith(EventType.X)` into an assertion on the awaited RETURN of the captured task/onTimeout fn (`expect(result).toEqual({ status: ... })`) — and note tests that invoke a **helper directly** (not via the captured task closure) need the same return-vs-emit rewrite. Add `Mappers`/`axios`/`axios-retry` module mocks where source now uses them. Propagate state-field renames + `AdapterState` replacement into fixtures (see §12). Record every rewritten test file.

17. **Verify.** From `<code>`: `npm install` (regenerate lockfile), then `npx tsc --noEmit`, `npm run lint`, `npm run build`, and tests if present. If a check fails, read the errors — a leftover `adapter.emit`, a dead symbol, a wrong adapter type, a missing `delaySeconds`, a destructure of `{reports}` off a loader, an orphaned dispatcher, or a test fixture on a renamed key is the usual cause. Fix and re-run. Up to 4 attempts. Never leave a compile error. If a check still fails after 4 attempts, record the exact remaining errors + touched files in `MIGRATION_REVIEW.md` under "Unresolved" and report failure — but package.json stays at 2.0.0.

18. **Report.** Summarize: which categories fired, which were verified no-ops, the final tsc/lint/build/test result, and the count of `MIGRATION_REVIEW.md` entries.

## Autonomy rules

- **Attempt every transform.** Never skip a category because it looks hard. If a category greps to zero hits, note it as a verified no-op and move on.
- **Best-effort on semantics.** When a rewrite is ambiguous, pick the option that PRESERVES existing runtime behavior with the smallest change, apply it, and log a review entry. Do not prompt the user.
- **Never leave a compile error.** Every removed symbol (`adapter.emit`, `WorkerAdapter` class, `ToDevRev`, `axiosClient`, `axios` named import, deleted enum members, `AdapterState`) must be gone by build time. Clean up EVERY orphaned import/local a rewrite creates (lint gates on it).
- **Tests are targets, not afterthoughts.** Source-only migration passes tsc but fails the test gate. Migrate `test/**` fixtures, mocks, and assertions in the same pass.
- **Preserve wire values.** Never change an enum's string value or a payload field's runtime value. Symbol/type renames only.
- **Record low-confidence rewrites.** Every `mechanical: false` category edit, and every item in the review-triggers list, gets a `MIGRATION_REVIEW.md` entry.
- **Do the categories in order.** Later categories assume earlier ones ran.

## Notes

- Phase inference (extraction vs loading) drives adapter-split and process-task-split: files under `.../extraction/workers/` are extraction; `.../loading/workers/` are loading. When the layout is unusual, inspect the body — `streamAttachments`/`getRepo`/`initializeRepos` ⇒ extraction; `loadItemTypes`/`loadAttachments`/`mappers` ⇒ loading.
- `mappers` lives on `LoadingAdapter` only. Extraction-phase mappers use must construct `new Mappers({ event: adapter.event })`.
- `axios-retry` is often a missing DIRECT dependency even though `axios` is present transitively — add both explicitly when you build a local client.
- Many connectors are already on `baseWorkerPath: __dirname`, already push ESUs to the repo, have no deep imports, and no SDK-owned state keys. Confirm-and-skip is correct for those — do not invent work.

## MIGRATION_REVIEW.md format

Create at the repo root. One `##` section per category that had semantic edits; one `###` bullet per touched site.

```markdown
# v2 Migration Review

Migrated `@devrev/ts-adaas` 1.19.x → `@devrev/airsync-sdk` 2.0.0.
Eyeball each entry below — these are semantic (behavior-affecting) rewrites, not mechanical renames.

## incremental-window
### code/src/functions/extraction/workers/data-extraction.ts:649 — confidence: medium
`lastSuccessfulSyncStarted` IS declared in the connector State interface (home-grown cursor) → RENAMED to
`lastSuccessfulWindowStart` across interface, getInitialState, 4 read/write sites, and 3 test fixtures.
NOT substituted with extract_from (the connector consumes extract_from separately). Verify no external
consumer relied on the old key name.

## incremental-window
### code/src/functions/extraction/workers/extraction-helpers.ts:302 — confidence: high
`adapter.state.lastSuccessfulSyncStarted` was NOT in the connector State interface (SDK-supplied via v1
AdapterState) → read repointed to `event_context.extract_from` (already destructured at :312). Write at
data-extraction.ts:255 deleted. One-time re-extract possible for a sync in flight across the upgrade; platform dedupes.

## Unresolved  (only if verify failed after 4 attempts)
- <exact tsc/lint error and the file:line still failing, plus what was tried>
```

Omit any section that had no semantic edits.
