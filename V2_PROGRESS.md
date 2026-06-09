# ADaaS SDK v2 Refactor — Progress & Plan (source of truth)

> This file is the **single source of truth** for the v2 refactor. It is self-contained:
> any session (or subagent) can read ONLY this file + the named git oracles and have
> everything needed. Do NOT rely on chat history. Update the **Status** table after every commit.

## TL;DR
Rebuild the v2 branch cleanly from `main` as a sequence of small, single-purpose, reviewable
commits. Mechanical/structural transforms first (Phase 1), polish + surface-defining work last
(Phase 2). `npm run build` stays green every commit; the test suite + api report are intentionally
**left broken** until the final steps. No npm publishing during the work.

## Git facts
- **Working branch:** `v2` (already hard-reset to `origin/main`).
- **Base commit:** `origin/main` = `5b81ef2` (feat: Add new common error enums #204).
- **Oracle (target shape):** `origin/v2` / tag `v2-old-backup` = `9202e47`. This is the PREVIOUS
  v2 attempt — it already implemented the rename, deletions, adapter split, state split+envelope,
  and emit-from-return, but bundled into huge unreviewable commits built on a stale base. **Use it
  as a structural reference / oracle only. Never copy wholesale. Re-author cleanly.**
- **Safety:** old work preserved at tag `v2-old-backup`. Force-push of `v2` is approved by Rado.

## Hard rules (apply to EVERY Phase-1 commit)
1. **`npm run build` must stay green.** Achieved by commit 1 adding a build tsconfig that excludes
   `**/*.test.ts`. (ts-jest still transpiles tests independently, so tests still *run* — and will
   fail on old names — that is expected and accepted.)
2. **Never touch `*.test.ts` files or any api-extractor report** (`*.api.md`, `*.api.json`,
   `latest.json`, backwards-compatibility fixtures) until Phase 2. Reviewer rejects any commit that does.
3. **Do NOT rename DevRev backend API route strings.** Only SDK-owned identifiers/types/classes are
   renamed Airdrop→AirSync. Route strings like `airdrop.sync-mapper-record.get-by-target` and any
   `/internal/airdrop.*` endpoints stay verbatim (they are platform API, not SDK naming).
4. **Every deletion must be grep-justified** (zero live references in SDK `src/` non-test + the 3
   inspectable connectors). Record the justification in the commit body.
5. Each commit is **single-purpose**. If a change belongs to a later commit, defer it.
6. Keep `multithreading/` directory name. No logging/console changes. Both out of scope.

## Commit sequence

### Phase 1 — structural (review commit-by-commit)
- **C0 — Package rename** `@devrev/ts-adaas` → `@devrev/airsync-sdk` (scoped, stays under @devrev).
  Touch: `package.json` `name`; README references; api-extractor config (entry point / package name);
  rename the report file `*/ts-adaas.api.md` → `airsync-sdk.api.md` IF trivial, else defer report to Phase 2.
  Do NOT publish. Version → `2.0.0-beta.0` placeholder.
- **C1 — Delete dead/deprecated code + add build tsconfig.**
  - Delete `src/deprecated/**` (see list below) and its exports from `src/index.ts`.
  - Delete `src/common/event-type-translation.ts` + `.test.ts` (the old↔new event-type shim).
  - Delete other `@deprecated`-tagged symbols / provably-unused code (grep-justified).
  - Add `tsconfig.build.json` (`include: ["src"]`, `exclude: ["**/*.test.ts","node_modules","dist"]`)
    and point `build` script at it. This is the "build stays green" enabler.
- **C2 — Airdrop→AirSync identifier rename.** SDK identifiers/types/classes/comments only.
  NOT API route strings (rule 3). e.g. `AirdropEvent`→`AirSyncEvent`, `AirdropMessage`→`AirSyncMessage`
  (verify exact target names against `origin/v2`). Provide back-compat type aliases ONLY if origin/v2 did.
- **C3 — Delete deprecated enum members** (NOT a rename — main carries old+new side by side; drop old).
  Leave only the new members. See enum tables below. Files: `src/types/extraction.ts`,
  `src/types/loading.ts`, plus any `case`/reference cleanups in `control-protocol.ts`, `spawn.helpers.ts`, adapters.
- **C4a — State split (structural only).** Introduce `BaseState` + `ExtractionState` + `LoadingState`.
  KEEP the flat `AdapterState<ConnectorState> = ConnectorState & SdkState` shape (behavior identical).
  Author fresh; origin/v2 `src/state/base-state.ts` etc. are structural reference only.
- **C4b — State envelope + migration.** Change on-disk shape to `{ connectorState, sdkState }`.
  Add migration shim: read legacy flat v1 blob → split SDK-owned keys into `sdkState` → persist envelope.
  (origin/v2 `base-state.ts` has the reference impl incl. `V1_SDK_STATE_KEYS`.)
- **C5 — Adapter split (structural only).** `BaseAdapter` + `ExtractionAdapter` + `LoadingAdapter`.
  KEEP existing `emit`-based contract working (behavior identical). Author fresh intermediate form
  (this exact form exists in NO branch — origin/v2's split already assumes emit-from-return).
- **C6 — Emit-from-return contract.** `task`/`onTimeout` return a `TaskResult`
  (`{ status: 'success'|'progress'|'delay'|'error', ... }`); the SDK maps status→phase event and emits
  exactly once; `emit` removed from public surface. `processTask` → `processExtractionTask` +
  `processLoadingTask`. Reference: origin/v2 `process-task.ts`, `base-adapter.ts` (mapping keys off
  event_type/phase, NOT off state shape — so C4b and C6 are independent).

### Phase 2 — closing / interactive (batched, done at the end)
- **C7 — JSDoc pass.** Bar = `src/mappers/mappers.ts` style (class block: what+when; method block:
  one-line what, "Used to/for…" usage, `@param` w/ type, `@returns`). Public surface + non-obvious
  internals (state migration, emit-from-return mapping, attachment streaming pool). Fan out per module,
  squash to one `docs:` commit.
- **C8 — Regenerate api report** (`airsync-sdk.api.md`).
- **C9 — Exposure audit (INTERACTIVE with Rado).** Read the regenerated report; decide per-symbol what
  to keep public vs hide. Empirical floor = anything imported by the 3 connectors (table below).
- **C10 — Fix tests + bw-compat baseline.** Update test files to new names/contract; decide re-baseline
  vs remove the backwards-compatibility gate (v2 is an intentional break, so a v1-comparison gate is wrong).
- **C11 — Migration deliverable.** Scan full `main..v2` diff → derive v1→v2 change catalog → build a
  **dedicated `migrate-v2` skill in `adaas-sdk`** (`.claude/skills/migrate-v2/`), later ported to the
  `connectors-codegen` repo (owns the `connector-dev` plugin). Mechanical changes auto-applied; semantic
  (emit-from-return, state access) flagged for review; ambiguous → `MIGRATION_TODO.md`. Validate against
  the 3 inspectable connectors. Skill philosophy mirrors existing `update-sdk` (autonomous + defer-on-ambiguity).

## Orchestration model
- Per Phase-1 commit, in the main session across multiple sittings:
  1. **Implementer subagent** — does the one commit's work; obeys all Hard rules; build stays green.
  2. **Reviewer subagent** (read-only) — verifies diff against that commit's contract + Hard rules
     (esp. "no test/report files touched", "deletions grep-justified", "structure-only vs behavior-only").
  3. Rado eyeballs → commit → next.
- Mini-workflows for parallel sub-steps: deletion grep-verification (C1), JSDoc-by-module (C7),
  exposure-by-symbol (C9).

---

## Reference data (baked in so future sessions don't re-derive)

### `src/deprecated/**` files to delete (C1)
```
src/deprecated/adapter/index.ts
src/deprecated/common/helpers.ts
src/deprecated/demo-extractor/external_domain_metadata.json
src/deprecated/demo-extractor/index.ts
src/deprecated/http/client.ts
src/deprecated/uploader/index.ts
```
Also delete `src/common/event-type-translation.ts` (+ `.test.ts`).
`src/index.ts` on main exports these deprecated barrels — remove those export lines:
`./deprecated/adapter`, `./deprecated/demo-extractor`, `./deprecated/http/client`, `./deprecated/uploader`,
and the `formatAxiosError` export (origin/v2 dropped it — confirm against connector usage; azure-boards imports it, so this is a migration note).

### C3 — EventType (incoming): DELETE these deprecated members, keep the new ones
| DELETE (old member = old VALUE)                              | KEEP (new member = new VALUE)                                            |
|--------------------------------------------------------------|--------------------------------------------------------------------------|
| ExtractionExternalSyncUnitsStart = EXTRACTION_EXTERNAL_SYNC_UNITS_START | StartExtractingExternalSyncUnits = START_EXTRACTING_EXTERNAL_SYNC_UNITS |
| ExtractionMetadataStart = EXTRACTION_METADATA_START          | StartExtractingMetadata = START_EXTRACTING_METADATA                      |
| ExtractionDataStart = EXTRACTION_DATA_START                  | StartExtractingData = START_EXTRACTING_DATA                              |
| ExtractionDataContinue = EXTRACTION_DATA_CONTINUE            | ContinueExtractingData = CONTINUE_EXTRACTING_DATA                        |
| ExtractionDataDelete = EXTRACTION_DATA_DELETE                | StartDeletingExtractorState = START_DELETING_EXTRACTOR_STATE             |
| ExtractionAttachmentsStart = EXTRACTION_ATTACHMENTS_START    | StartExtractingAttachments = START_EXTRACTING_ATTACHMENTS                |
| ExtractionAttachmentsContinue = EXTRACTION_ATTACHMENTS_CONTINUE | ContinueExtractingAttachments = CONTINUE_EXTRACTING_ATTACHMENTS       |
| ExtractionAttachmentsDelete = EXTRACTION_ATTACHMENTS_DELETE  | StartDeletingExtractorAttachmentsState = START_DELETING_EXTRACTOR_ATTACHMENTS_STATE |
Loading members (StartLoadingData…StartDeletingLoaderAttachmentState) + UnknownEventType are unchanged.

### C3 — ExtractorEventType (outgoing): DELETE deprecated, keep new
| DELETE (old)                          | KEEP (new)                              |
|---------------------------------------|-----------------------------------------|
| ExtractionExternalSyncUnitsDone       | ExternalSyncUnitExtractionDone          |
| ExtractionExternalSyncUnitsError      | ExternalSyncUnitExtractionError         |
| ExtractionMetadataDone                | MetadataExtractionDone                  |
| ExtractionMetadataError               | MetadataExtractionError                 |
| ExtractionDataProgress                | DataExtractionProgress                  |
| ExtractionDataDelay                   | DataExtractionDelayed                   |
| ExtractionDataDone                    | DataExtractionDone                      |
| ExtractionDataError                   | DataExtractionError                     |
| ExtractionDataDeleteDone              | ExtractorStateDeletionDone              |
| ExtractionDataDeleteError             | ExtractorStateDeletionError             |
| ExtractionAttachmentsProgress         | AttachmentExtractionProgress            |
| ExtractionAttachmentsDelay            | AttachmentExtractionDelayed             |
| ExtractionAttachmentsDone             | AttachmentExtractionDone                |
| ExtractionAttachmentsError            | AttachmentExtractionError               |
| ExtractionAttachmentsDeleteDone       | ExtractorAttachmentsStateDeletionDone   |
| ExtractionAttachmentsDeleteError      | ExtractorAttachmentsStateDeletionError  |
(values for new members are the *_EXTRACTION_* / *_DELETION_* strings — see origin/v2 extraction.ts.)

### C3 — LoaderEventType: DELETE deprecated typo/plural members
DELETE: `DataLoadingDelay` (typo), `AttachmentsLoadingProgress/Delayed/Done/Error` (the plural-typo dupes).
KEEP: `DataLoadingProgress, DataLoadingDelayed, DataLoadingDone, DataLoadingError,
AttachmentLoadingProgress/Delayed/Done/Error, LoaderStateDeletionDone/Error,
LoaderAttachmentStateDeletionDone/Error, UnknownEventType`.

### Connector import surface (empirical floor for C9 exposure audit + C11 migration)
Symbols imported from `@devrev/ts-adaas` by the 3 inspectable connectors:
- **asana-internal:** AirSyncDefaultItemTypes, AirdropEvent, ErrorRecord, EventType, ExternalDomainMetadata,
  ExternalSyncUnit, ExtractorEventType, LoaderEventType, NormalizedAttachment, NormalizedItem, RepoInterface,
  SyncMode, WorkerAdapter, axios, processTask, spawn
- **azure-boards:** AirSyncDefaultItemTypes, AirdropEvent, AirdropMessage, EventType, ExternalSyncUnit,
  ExternalSystemAttachment, ExternalSystemItem, ExternalSystemItemLoadingParams, ExtractorEventType,
  LoaderEventType, NormalizedAttachment, NormalizedItem, SyncMode, WorkerAdapter, formatAxiosError,
  installInitialDomainMapping, processTask, spawn
- **google-drive:** AirdropEvent, EventType, ExternalSystemAttachmentStreamingParams, ExtractorEventType,
  NormalizedAttachment, NormalizedItem, SyncMode, WorkerAdapter, processTask, spawn, axios, axiosClient

**Migration-relevant removals these connectors will hit:** `WorkerAdapter` (removed → use processExtraction/LoadingTask
+ return-based contract), `processTask` (split), `formatAxiosError` (dropped from index), `AirdropEvent`/`AirdropMessage`
(renamed AirSync*), all old `EXTRACTION_*` enum members (deleted).

## Status
| Commit | State | Notes |
|--------|-------|-------|
| C0 package rename     | ☑ done | 8ddeb87. @devrev/ts-adaas→@devrev/airsync-sdk, v2.0.0-beta.0. Report filename rename deferred to C8. |
| C1 delete + tsconfig  | ☐ todo | |
| C2 AirSync rename     | ☐ todo | |
| C3 enum cleanup       | ☐ todo | |
| C4a state split       | ☐ todo | |
| C4b state envelope    | ☐ todo | |
| C5 adapter split      | ☐ todo | |
| C6 emit-from-return   | ☐ todo | |
| C7 JSDoc              | ☐ todo | Phase 2 |
| C8 api report         | ☐ todo | Phase 2 |
| C9 exposure audit     | ☐ todo | Phase 2, interactive |
| C10 tests + baseline  | ☐ todo | Phase 2 |
| C11 migrate-v2 skill  | ☐ todo | Phase 2 |
