# @devrev/airsync-sdk — v2 Refactor One-Pager

**Branch:** `v2-refactor-plan` (off `v2` @ `f9f0c9e`, the `2.0.0-beta.2` release).
**Goal:** Separate extraction and loading into distinct, typed, encapsulated API surfaces; restructure where the new boundary actually exists; land it in green, reviewable chunks.
**Out of scope:** asana migration / cross-repo validation (separate ticket). Top-level phase-based folder reorg. New read-only SDK getters (YAGNI).

---

## Decisions (grilled & locked)

1. **Deep public split.** Two adapter classes `ExtractionAdapter`/`LoadingAdapter` (extending an internal `BaseAdapter`) + two entry points `processExtractionTask`/`processLoadingTask`. A loading worker cannot call `initializeRepos`; an extraction worker cannot call `loadItemTypes` — enforced at compile time. This *is* the breaking change. Aligns with the fact that `spawn` already routes each phase to its own worker file.

2. **Full state encapsulation.** `adapter.state` returns **only** `ConnectorState`. SDK bookkeeping (`workersOldest`, `workersNewest`, pending boundaries, `toDevRev`, `fromDevRev`, `snapInVersionId`) moves into an internal `state.sdkState` invisible to connector code. In-place mutation of connector fields (`adapter.state.foo = bar`) still works → cheap migration. **Verified safe:** asana has zero references to SDK-internal state fields and reads `extract_from`/`extract_to` from `event.payload.event_context`, never from state — no escape hatch needed.

3. **Disjoint typed state.** `BaseState<C>` owns `connectorState` + `init`/`postState`/`fetchState`. `ExtractionState extends BaseState` declares typed `sdkState: ExtractionSdkState`; `LoadingState extends BaseState` declares `sdkState: LoadingSdkState`. No runtime `mode` dispatch in construction — each entry point calls its own factory. IDM install + time-value resolution live only in the extraction factory; loading factory is minimal.

4. **Adapter generic over its state.** `BaseAdapter<C, S extends BaseState<C>>` — eliminates per-call narrows. Each adapter subclass holds its corresponding `State` subclass.

5. **`emit()` = template method on `BaseAdapter`.** Base owns all shared scaffolding (already-emitted guard, `postState`, control-protocol emit, `postMessage`, error handling). Subclasses implement `protected abstract beforeEmit(eventType)` and `protected abstract buildEmitPayload(eventType)`. Extraction `beforeEmit` does boundary updates (`workersOldest`/`workersNewest` on `AttachmentExtractionDone`) **and owns the "upload all repos before emit" step** (repos are extraction-only — `BaseAdapter` stays repo-free; loading's would be a no-op). `buildEmitPayload` adds `artifacts` (extraction) vs `reports`/`processed_files` (loading).

6. **State migration shim (read-both, write-new).** v2 `init()` detects on read: if `'sdkState' in parsed` → envelope, use as-is; else flat v1 blob → split recognized SDK keys into `sdkState`, rest into `connectorState`. Recognized keys derived from the initial-state constants (`V1_SDK_STATE_KEYS`) so they auto-update. Always writes the envelope. Malformed (one side missing) fails loud. **Time-bombed for removal in v2.1** — confirm with platform team whether sync state survives a snap-in version upgrade *before* removing, not before building (cheap insurance).

7. **Folder layout — hybrid, minimal churn.** Introduce the split only where the boundary exists; leave feature folders (`repo/`, `mappers/`, `uploader/`, `http/`, …) untouched. No `shared/` junk drawer, no phase-based top level.
   - `src/multithreading/adapters/{base-adapter,extraction-adapter,loading-adapter}.ts` (renamed from `worker-adapter/`, drop the `worker-` prefix).
   - `src/state/{base-state,extraction-state,loading-state,state.interfaces}.ts`.
   - Entry points stay in `src/multithreading/process-task.ts` (now exporting two functions).

8. **Public export surface — minimal.** Export `processExtractionTask`, `processLoadingTask`, `ExtractionAdapter`, `LoadingAdapter`. **Remove** `processTask`, `WorkerAdapter`, `AdapterState<T>`. Do **not** export `BaseAdapter` (would invite mode-agnostic helpers that defeat the split). SDK state types (`ExtractionSdkState`, `LoadingSdkState`, `ToDevRev`, `FromDevRev`) stay internal. Devs declare their own `ConnectorState` and pass it as the generic.

9. **Module ownership (verified by import analysis).** Extraction-only: `repo/`, `attachments-streaming/`, `time-value-resolver`. Loading-only: `mappers/`. Shared: `uploader/` (extraction streams attachments; loading reads stats/transformer files), `control-protocol`, `logger`, `http`, `BaseState`.

---

## Chunking — sequenced commits, one PR, green at each commit

Dependency order is fixed: state → adapters → entry points; folder rename rides along; shim is part of the state chunk.

| # | Commit | Contents | Green gate |
|---|--------|----------|------------|
| 1 | **Encapsulate state + envelope + shim** | `State` holds split `connectorState`/`sdkState` (sdkState keeps the existing all-optional `SdkState` shape — no disjoint typing yet); `adapter.state` → `ConnectorState` only; SDK code reads via `adapterState.sdkState`; `{connectorState, sdkState}` on-disk envelope; read-both/write-new `init()` + `V1_SDK_STATE_KEYS`; decouple `AttachmentsStreamingPool` from `adapter.state` (pass `attachmentsMetadata`). Monolithic adapter retained. | tests green |
| 2 | **Split adapters + disjoint state types** | `BaseState`/`ExtractionState`/`LoadingState` with distinct `sdkState` types + per-mode factories; `BaseAdapter<C,S>` + `ExtractionAdapter`/`LoadingAdapter`; template-method `emit()` with `beforeEmit`/`buildEmitPayload`; method allocation (extraction: repos/attachments/streaming; loading: load*/mappers/reports). Disjoint typing lands here (with the split) so no throwaway narrows. | tests green |
| 3 | **Split entry points** | `processExtractionTask`/`processLoadingTask` + private `runWorkerTask` helper (logger context, timeout wiring, error/exit plumbing). Generic worker interfaces in `types/workers.ts`. | tests green |
| 4 | **Folder rename + exports** | `worker-adapter/` → `adapters/`, drop `worker-` prefix; update `index.ts` per Decision 8; regenerate `airsync-sdk.api.md` + backwards-compat snapshot. | tests green |

Tests stay green per commit (disciplined; not the "tests last" approach). One PR at the end, reviewable commit-by-commit.

---

## Open items (not blocking the build)
- Platform confirmation: does sync state survive a snap-in version upgrade? → gates v2.1 shim removal (Decision 6), not the build.
- asana migration → separate ticket.
