# v2 Migration — Transform Catalog

The 16 breaking-change categories, each with **detect** (grep), **transform** (recipe), **before/after**, and **pitfalls**. Apply in the SKILL.md order. Every recipe here was validated by tracing 5 real connectors (asana, confluence, hubspot, google-drive, google-calendar) — the pitfalls are real failures those traces surfaced.

> **Grep-ordering invariant.** SKILL.md step 1 already replaced `@devrev/ts-adaas` → `@devrev/airsync-sdk` everywhere (including `dist/**` paths — substring replace). So **all detect greps below target the NEW specifier or bare symbol names**, never `@devrev/ts-adaas`. A grep for the old string returns zero hits after step 1 and produces a false "no-op".

Wire protocol is unchanged: every surviving enum STRING VALUE is byte-identical v1→v2. Rename symbols/types only; never change a runtime string value.

---

## 1. package-rename (mechanical)

**Detect:** `grep -rn "@devrev/ts-adaas" . --include=package.json --include='*.ts'` (run FIRST, before any other category).

**Transform:** `npm uninstall @devrev/ts-adaas && npm install @devrev/airsync-sdk@beta` (the `beta` dist-tag resolves to the newest published 2.x — currently `2.0.0-beta.4`; there is NO plain `2.0.0` on npm yet, so `@2.0.0` would 404 and abort the migration. Switch to `@2.0.0` once GA ships). Then global-replace the literal string `@devrev/ts-adaas` → `@devrev/airsync-sdk` in every `.ts` import, `jest.mock('...')`, `jest.requireActual('...')`, and `moduleNameMapper`. This rewrites deep-import path prefixes too (`.../ts-adaas/dist/x` → `.../airsync-sdk/dist/x`). Do NOT rename symbols yet.

**Pitfalls:** this step is why every later detect grep must use the NEW specifier. Regenerate the lockfile with `npm install` at the end (step 17), not here.

---

## 2. deep-imports (mechanical)

**Detect:** `grep -rnE "@devrev/airsync-sdk/dist" src test` (NEW specifier — step 1 already rewrote the prefix).

**Transform per path:**
- `dist/repo/repo.interfaces` (`Item`, `NormalizedItem`, `NormalizedAttachment`, `RepoInterface`) → root import `@devrev/airsync-sdk`.
- `dist/types/loading` (`ItemTypeToLoad`, `ExternalSystemItemLoadingResponse`, …) → root.
- `dist/mappers/mappers` (`Mappers`) → root.
- `dist/types/extraction` (`InitialSyncScope`) → root.
- `dist/logger/logger` (`serializeAxiosError`) → **CONDITIONAL** (see §14): keep it via this deep path if its result is spread/object-accessed; else swap to root `serializeError`.
- `dist/state/state.interfaces` (`ToDevRev`) → **DROP the import entirely** (SDK-internal, no public replacement; `toDevRev` is SDK-managed under `adapter.sdkState`). Remove its usages (see §12).
- `dist/http/axios-client` (`axiosClient`) → remove; bring your own axios (§14). File renamed to `http/client`, internal.
- `dist/state/state` (`State` class, `createAdapterState`) → **REMOVED** (see §12). Both are gone from the module; the barrel now re-exports only `BaseState`, `ExtractionState`/`createExtractionState`, `LoadingState`/`createLoadingState`. Map by how the v1 symbol was used, NOT with a blanket swap: **synchronous** `new State({ event, initialState })` (as in a hand-built-adapter integration test) → **synchronous** `new LoadingState({ event, initialState, options? })` (loading phase) or `new ExtractionState({ … })` (extraction) — a true drop-in, both class constructors are exported from the root barrel and take the same `{ event, initialState, initialDomainMapping?, options? }` shape. v1's **async** `createAdapterState({ … })` (which fetched persisted state) → the **async** `createLoadingState(…)` / `createExtractionState(…)` factories (root barrel; `await` them and make the caller `async`). A test that also pokes `adapterState.state = { fromDevRev: … }` must move that onto the sdkState envelope (§12) — the constructor swap alone won't type-check.
- `dist/mappers/mappers.interface` (SINGULAR): none of the four `*Response` interfaces (`MappersGetByExternalIdResponse`, `MappersGetByTargetIdResponse`, `MappersCreateResponse`, `MappersUpdateResponse`) are on the root barrel — nor are `SyncMapperRecord`, `SyncMapperRecordExternalVersion`, `UpdateSyncMapperRecordParams`, or `MappersFactoryInterface` → repoint any of these to the plural `@devrev/airsync-sdk/dist/mappers/mappers.interfaces`. Only the four `*Params` interfaces (`MappersCreateParams`, `MappersGetByExternalIdParams`, `MappersGetByTargetIdParams`, `MappersUpdateParams`) and the two enums (`SyncMapperRecordStatus`, `SyncMapperRecordTargetType`) ARE on root → prefer root for those.

**Before**
```ts
import { Item } from '@devrev/airsync-sdk/dist/repo/repo.interfaces';
import { ToDevRev } from '@devrev/airsync-sdk/dist/state/state.interfaces';
import { MappersGetByExternalIdResponse } from '@devrev/airsync-sdk/dist/mappers/mappers.interface';
```
**After**
```ts
import { Item } from '@devrev/airsync-sdk';
// ToDevRev import removed (SDK-internal)
import { MappersGetByExternalIdResponse } from '@devrev/airsync-sdk/dist/mappers/mappers.interfaces';
```

**Pitfalls:** `mappers.interface` → `mappers.interfaces` (singular→plural) breaks even though symbols are unchanged. Do NOT repoint `ToDevRev` — drop it. `Item` IS on the root barrel (verified) — repoint, don't keep the deep path. Many connectors have zero deep imports (verified no-op).

---

## 3. event-type-rename (mechanical)

**Detect:** `grep -rnE "\bAirdropEvent\b|\bAirdropMessage\b|CustomAirdropEvent" src test`.

**Transform:** `AirdropEvent`→`AirSyncEvent`, `AirdropMessage`→`AirSyncMessage` in every annotation, generic, cast, `extends`. Payload shape is identical.

`CustomAirdropEvent` handling: v2's `AirSyncEvent.context` natively carries **five** identity fields — `user_id`, `dev_oid`, `source_id`, `service_account_id`, and `snap_in_id` (the last was already present in v1). If a hand-rolled `CustomAirdropEvent` only added members from that set, DELETE it and read `adapter.event.context.<field>` directly. If it added OTHER fields, rebase it: `interface CustomEvent extends AirSyncEvent { ... }`.

**Before**
```ts
const run = async (events: AirdropEvent[]) => { ... };
```
**After**
```ts
const run = async (events: AirSyncEvent[]) => { ... };
```

**Pitfalls:** do NOT mass-rename other `Airdrop*`/`Extractor*` tokens (routes, `AIRDROP_*` mapping enum values, `'ADaaS'` literal are platform-owned and unchanged). The identity-field set is FIVE, not four — omitting `snap_in_id` leaves a needless cast. `WorkerAdapterInterface`/`WorkerAdapterOptions` are unrelated (kept — see §5).

---

## 4. deleted-enum-members (mechanical)

**Detect:** `grep -rnE "EventType\.|ExtractorEventType\.|LoaderEventType\.|ExtractionMode|EventContextIn|EventContextOut|translate(Incoming|Outgoing|Extractor|Loader)EventType" src test`.

**Transform:** the deprecated members were deleted; surviving members keep byte-identical string values. Map:

| Deleted | Use instead |
|---|---|
| `EventType.ExtractionExternalSyncUnitsStart` | `EventType.StartExtractingExternalSyncUnits` |
| `EventType.ExtractionMetadataStart` | `EventType.StartExtractingMetadata` |
| `EventType.ExtractionDataStart` | `EventType.StartExtractingData` |
| `EventType.ExtractionDataContinue` | `EventType.ContinueExtractingData` |
| `EventType.ExtractionDataDelete` | `EventType.StartDeletingExtractorState` |
| `EventType.ExtractionAttachmentsStart` | `EventType.StartExtractingAttachments` |
| `EventType.ExtractionAttachmentsContinue` | `EventType.ContinueExtractingAttachments` |
| `EventType.ExtractionAttachmentsDelete` | `EventType.StartDeletingExtractorAttachmentsState` |
| `ExtractorEventType.Extraction*` (Done/Error/Progress/Delay/…) | the `*Extraction*` member (`DataExtractionDone`, `AttachmentExtractionDelayed`, …) |
| `LoaderEventType.DataLoadingDelay` | `LoaderEventType.DataLoadingDelayed` |
| `LoaderEventType.AttachmentsLoading*` (plural) | `LoaderEventType.AttachmentLoading*` (singular) |
| `*.UnknownEventType` (any enum) | raw string `'UNKNOWN_EVENT_TYPE'` — the member is GONE |
| `ExtractionMode` | `SyncMode` |
| `EventContextIn` / `EventContextOut` | `EventContext` |
| `translate*EventType(...)` | delete the call; the platform sends modern strings |

**Pitfalls:** `LoaderEventType.UnknownEventType` does NOT survive (replaced by an un-exported constant), and neither do the `EventType`/`ExtractorEventType` copies. Any `*.UnknownEventType` reference → the raw `'UNKNOWN_EVENT_TYPE'` string (value unchanged, so the wire is fine). In practice `ExtractorEventType`/`LoaderEventType` are rarely referenced by name after emit→return (§7) removes the emit sites. Most connectors already use the modern members (verified no-op for the enum values).

---

## 5. adapter-split (semantic — log review entry)

**Detect:** `grep -rnE "WorkerAdapter" src test` — the CLASS is removed, so BOTH forms are sites: `WorkerAdapter<T>` type annotations AND value-context `new WorkerAdapter(…)` construction (common in hand-built-adapter integration tests). Match `WorkerAdapter` in ANY import line (not the literal `import { WorkerAdapter }`, which misses multi-symbol imports like `import { AirSyncDefaultItemTypes, WorkerAdapter } from …`).

**Transform:** `WorkerAdapter<T>` → `ExtractionAdapter<T>` (extraction-phase file) or `LoadingAdapter<T>` (loading-phase file). Infer phase from directory (`extraction/` vs `loading/`) or body (`getRepo`/`initializeRepos`/`streamAttachments` ⇒ Extraction; `loadItemTypes`/`loadAttachments`/`mappers` ⇒ Loading). Import the chosen class from root. Leave `WorkerAdapterInterface`/`WorkerAdapterOptions` (still exported). If an EXTRACTION-phase helper touched `adapter.mappers`/`reports`/`processedFiles`, those are LoadingAdapter-only now → construct `new Mappers({ event: adapter.event })` (hoist out of per-item loops).

**Value-construction recipe** (hand-built-adapter integration tests — real SDK, only network boundaries stubbed): `new WorkerAdapter({ event, adapterState })` → `new LoadingAdapter({ event, adapterState })` (loading) or `new ExtractionAdapter({ event, adapterState })` (extraction). Constructor shape is `{ event: AirSyncEvent; adapterState: BaseState<ConnectorState>; options? }`. This is COUPLED to the §2/§12 state-class change: the `adapterState` is usually built with the removed `new State({ event, initialState })` → becomes `new LoadingState(…)` / `new ExtractionState(…)`. Any `adapterState.state = { fromDevRev: … }` test hack moves onto the sdkState envelope (§12).

**Before**
```ts
async function extractList(adapter: WorkerAdapter<State>) { ... }
```
**After**
```ts
import { ExtractionAdapter } from '@devrev/airsync-sdk';
async function extractList(adapter: ExtractionAdapter<State>) { ... }
```

**Pitfalls:** don't blindly rename every `WorkerAdapter` token — only the `<T>` annotations. A single helper shared across phases may need overloading or splitting. Flag any mappers-moved-to-loading rewrite.

---

## 6. process-task-split (mechanical, paired with emit-to-return)

**Detect:** `grep -rn "processTask" src test`.

**Transform:** `processTask` → `processExtractionTask` (extraction workers) / `processLoadingTask` (loading workers), in import and call site; keep `<State>` generic. Must be applied together with §7 for that file (the callback body changes).

**Before**
```ts
import { processTask } from '@devrev/airsync-sdk';
processTask<ExtractorState>({ task: async ({ adapter }) => { ... } });
```
**After**
```ts
import { processExtractionTask } from '@devrev/airsync-sdk';
processExtractionTask<ExtractorState>({ task: async ({ adapter }) => { ... } });
```

**Pitfalls:** phase is per-file (a connector has both). `ProcessTaskInterface` is still exported, but its generic changed meaning: v1 `ProcessTaskInterface<ConnectorState>` (with `task: (…) => Promise<void>`) → v2 `ProcessTaskInterface<Adapter>` (with `task: (…) => Promise<TaskResult>` and `onTimeout` now optional). Any connector that referenced the type must rewrite `ProcessTaskInterface<State>` → `ProcessTaskInterface<ExtractionAdapter<State>>` (or `LoadingAdapter<State>`), not keep passing the bare State. Its sibling `TaskAdapterInterface` (the params type of `task`/`onTimeout`) underwent the IDENTICAL flip — v1 `TaskAdapterInterface<ConnectorState>` (`adapter: WorkerAdapter<ConnectorState>`) → v2 `TaskAdapterInterface<Adapter>` (`adapter: Adapter`) — so a connector annotating its worker signature as `TaskAdapterInterface<State>` must likewise rewrite it to `TaskAdapterInterface<ExtractionAdapter<State>>` / `LoadingAdapter<State>`; keeping bare `<State>` silently types `adapter` as the ConnectorState.

---

## 7. emit-to-return (semantic — the core change; log review entries)

**Detect:** `grep -rnE "\.emit\(" src`. Any `adapter.emit`/`this.adapter.emit`/`this.emit` is a v2 compile error (emit is protected). Also find void/boolean helpers and class methods that call emit.

**Translation table (apply at each emit site):**
| v1 emit | v2 return |
|---|---|
| `emit(XxxDone)` | `return { status: 'success' }` |
| `emit(XxxProgress[, { progress }])` | `return { status: 'progress' }` (DROP the `progress` payload) |
| `emit(XxxDelayed, { delay })` | `return { status: 'delay', delaySeconds: delay }` (**KEY RENAME `delay` → `delaySeconds`**) |
| `emit(XxxError, { error })` | `return { status: 'error', error }` |
| `emit(XxxDone, { error })` — Done carrying a NON-fatal error summary | `return { status: 'success' }` + surface the error via a `reports` entry or `console.warn` (do NOT map to `error` status — that emits `*Error` and fails the phase) |
| bare `return;` inside `if (adapter.isTimeout)` in a resumable phase | `return { status: 'progress' }` |

**Three emit-site shapes:**
- **(a) In the task closure:** rewrite in place per the table.
- **(b) Buried in a shared void/boolean helper:** change the helper to RETURN `TaskResult | null` (`null` = keep going); caller does `const stop = await helper(); if (stop) return stop;`. For a deep sub-helper that emitted-and-continued (multi-emit in v1), downgrade the sub-emit to `console.error(serializeError(error))` + continue and let ONLY the top-level task synthesize the terminal result (**flag — partial-failure behavior changes**).
- **(c) In CLASS instance methods with a boolean-abort protocol** (e.g. `extractUsers(): Promise<boolean>` returns `false` to abort, caller does `if (!ok) return;`, and emits live inside the methods): `false` conflated error/delay/timeout in v1. Convert the methods to return `Promise<TaskResult | null>` (`null` = success/continue), OR add a `private result?: TaskResult` field that methods set and a `private finalResult(): TaskResult { return this.result ?? { status: 'progress' } }` the task returns. The task closure returns the bubbled/stored `TaskResult`. Pick whichever is the smaller change for the connector's structure; **flag it**.

Remove `process.exit()` (SDK owns worker exit). Drop blocking `wait()`/`sleep` before a delay return. Preserve state writes that must happen BEFORE the return.

**Before**
```ts
try { await extract(); adapter.state[t].completed = true; }
catch (error) {
  const { delay, error: extractionError } = handleExtractionError(error);
  if (delay) await adapter.emit(ExtractorEventType.DataExtractionDelayed, { delay });
  else await adapter.emit(ExtractorEventType.DataExtractionError, { error: extractionError });
  return;
}
await adapter.emit(ExtractorEventType.DataExtractionDone);
```
**After**
```ts
try { await extract(); adapter.state[t].completed = true; }
catch (error) {
  const { delay, error: extractionError } = handleExtractionError(error);
  if (delay) return { status: 'delay', delaySeconds: delay };
  return { status: 'error', error: extractionError ?? { message: `Error during ${t} extraction` } };
}
return { status: 'success' };
```

**Class-method (c) sketch**
```ts
// v1: method emits, returns false to abort
private async handlePermissionDeniedError() {
  await this.adapter.emit(ExtractorEventType.DataExtractionError, { error: { message: '...' } });
  return false;
}
// v2: method records the result; task returns it
private result?: TaskResult;
private handlePermissionDeniedError(): boolean {
  this.result = { status: 'error', error: { message: '...' } };
  return false; // still aborts the loop
}
// in the task closure, after gDriveConnector.extractData():
return this.result ?? { status: 'success' };
```

**Pitfalls:** `delay` → `delaySeconds` is the most-missed rename. `ErrorRecord` requires a defined `message` (add `?? { message: ... }`). A `Done` with an error summary must NOT become `{status:'error'}` (silently flips a successful phase to failed). Must-run-on-timeout cleanup belongs in `onTimeout` (§10), not after a timeout return (timeout outcome always wins). Class-method emits (google-drive shape) are the hardest — trace the boolean-abort protocol end to end.

---

## 8. loader-method-return (semantic — log review entry)

**Detect:** `grep -rnE "loadItemTypes\(|loadAttachments\(|streamAttachments\(" src`. Look for the `response?.delay`/`response?.error` emit ladder AND for `const { reports, processed_files } = await adapter.loadAttachments(...)`.

**Transform:** these methods now RETURN a `TaskResult` (rate-limit → delay, timeout → progress, error → error, done → success; `reports`/`processed_files`/artifacts attach to the emitted event automatically). The `TaskResult` union has **no** `reports`/`processed_files` members.
- Simple case → pass-through: `return adapter.streamAttachments({ stream, batchSize });`.
- Defensive outer try/catch with bespoke 429 handling → keep it: `return await adapter.loadItemTypes(...)` in try, map escaped throws to `{status:'delay'|'error'}` in catch.
- **Connector destructures `{ reports, processed_files }` off the call, or pushes a synthetic report into the returned array** (e.g. a NOTES summary): this is a tsc error in v2. Instead push onto the LIVE getter BEFORE returning: `adapter.reports.push(mySyntheticReport); return await adapter.loadAttachments(...);`. Never destructure the `TaskResult`.

**Before**
```ts
const { reports, processed_files } = await this.adapter.loadAttachments({ create });
reports.push(buildNotesReport(...));   // synthetic summary
return { reports, processed_files };
```
**After**
```ts
this.adapter.reports.push(buildNotesReport(...));   // push onto the live getter first
return await this.adapter.loadAttachments({ create });
```

**Pitfalls:** destructuring `{reports,processed_files}` off the return is the trap (hubspot) — TaskResult has neither. A success-side `console.log` after the old ladder disappears (success isn't observable pre-call). The connector-implemented `stream()`/`getFileStream()` is UNCHANGED. Flag keep-vs-collapse and any augmented-reports rewrite.

---

## 9. esu-repo (semantic — log review entry)

**Detect:** `grep -rnE "external_sync_units|ExternalSyncUnitExtractionDone" src`. (A) already `getRepo(EXTERNAL_SYNC_UNITS).push(...)` → near no-op; (B) emits inline `{ external_sync_units }` → real rewrite.

**Transform:**
- **Case A:** convert only the trailing `emit(ExternalSyncUnitExtractionDone)` → `return { status: 'success' }` (via §7). Leave existing repo setup.
- **Case B:** add before the push, then return:
```ts
adapter.initializeRepos([{ itemType: AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS, overridenOptions: { batchSize: 25000, skipConfirmation: true } }]);
await adapter.getRepo(AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS)?.push(externalSyncUnits);
return { status: 'success' };
```

**Before**
```ts
await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone, { external_sync_units: externalSyncUnits });
```
**After**
```ts
adapter.initializeRepos([{ itemType: AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS, overridenOptions: { batchSize: 25000, skipConfirmation: true } }]);
await adapter.getRepo(AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS)?.push(externalSyncUnits);
return { status: 'success' };
```

**Pitfalls:** `EventData.external_sync_units` is fully removed — the inline emit is a hard compile error. ESU is NON-RESUMABLE: keep an explicit `onTimeout` returning `{status:'error'}` (§10). Drop rate-limit `wait()` here. An uncaught `throw` becomes an error emit, so a fall-through `throw` can remain. **Case-B ESU tests break hard** — the mock adapter needs `initializeRepos`/`getRepo` and `AirSyncDefaultItemTypes`, and the emit-called assertion becomes a repo-push + return assertion (§16, hand-written).

---

## 10. onTimeout (semantic — log review entry)

**Detect:** `grep -rn "onTimeout" src`. Classify phase: RESUMABLE = data/attachment extraction, data/attachment loading; NON-RESUMABLE = external sync units, metadata, state deletion.

**Transform:** rewrite `onTimeout` to RETURN a `TaskResult`.
- Resumable, empty body → `onTimeout: async () => ({ status: 'progress' })` (or omit entirely — SDK default is progress).
- Non-resumable → explicit `onTimeout: async () => ({ status: 'error', error: { message: '<existing message>' } })`.
- **Body with side effects (any phase)** → PRESERVE the body, replace only the trailing emit with the returned result. Do NOT omit it.

Drop `adapter.postState()` inside `onTimeout` (SDK persists around the timeout emit). Drop `process.exit`.

**Before (side-effecting)**
```ts
onTimeout: async ({ adapter }) => {
  activeMetadataExtractor?.cancelRateLimiting();
  await adapter.emit(ExtractorEventType.MetadataExtractionError, { error: { message: 'Failed to extract metadata. Lambda timeout.' } });
}
```
**After**
```ts
onTimeout: async () => {
  activeMetadataExtractor?.cancelRateLimiting();
  return { status: 'error', error: { message: 'Failed to extract metadata. Lambda timeout.' } };
}
```

**Pitfalls:** timeout outcome ALWAYS wins — the SDK emits the onTimeout (or default progress) result and ignores the task's return. **Never omit an onTimeout whose body does real work** (`cancelRateLimiting()`, clearing `repo.uploadedArtifacts`) — that silently drops cleanup (google-calendar, hubspot). Wrong resumable classification turns a metadata/ESU timeout into a generic error.

---

## 11. mappers-unwrap (semantic — log review entry; silent-failure trap)

**Detect:** `grep -rnE "mappers\.(getByTargetId|getByExternalId|create|update)" src test`. Also `.data?.sync_mapper_record`/`.data.sync_mapper_record` reads, hand-rolled `Promise<{ data?: {...} }>` param types, AND mapper test doubles `mockResolvedValue({ data: { ... } })`.

**Transform:** `getByTargetId`/`getByExternalId`/`create`/`update` now return `Promise<Body>` (not `Promise<AxiosResponse<Body>>`).
1. Drop `.data` at read sites: `response.data?.sync_mapper_record` → `response.sync_mapper_record`.
2. Drop the `data?:` wrapper in hand-rolled structural param types.
3. **Unwrap the TEST DOUBLES:** `getByTargetId: jest.fn().mockResolvedValue({ data: { sync_mapper_record: {...} } })` → `mockResolvedValue({ sync_mapper_record: {...} })`. Otherwise the source reads `response.sync_mapper_record` = undefined and the test fails — and these test files often import no SDK, so §16's detection misses them.

**Before**
```ts
// source
const r = await mappers.getByTargetId({ sync_unit, target });
return r.data?.sync_mapper_record?.external_ids?.[0] ?? null;
// test double
getByTargetId: jest.fn().mockResolvedValue({ data: { sync_mapper_record: { external_ids: ['x'] } } }),
```
**After**
```ts
// source
const r = await mappers.getByTargetId({ sync_unit, target });
return r.sync_mapper_record?.external_ids?.[0] ?? null;
// test double
getByTargetId: jest.fn().mockResolvedValue({ sync_mapper_record: { external_ids: ['x'] } }),
```

**Pitfalls:** fixing only the source OR only the type OR only the read (not the test double) leaves a bug. `mappers` lives on `LoadingAdapter` only; extraction-phase use needs `new Mappers({ event })` (hoist out of loops). `Mappers` is a root export; `*Params`/`*Response` interfaces are on `mappers.interfaces` (plural). Always flag (silent runtime change).

---

## 12. state-sdk-fields (semantic — highest data-loss risk; log review entry)

**Detect:** inspect the connector's `State` interface + `getInitialState` for SDK-owned key names (`toDevRev`, `fromDevRev`, `workersOldest`, `workersNewest`, `pendingWorkers*`, `snapInVersionId`, `lastSyncStarted`, `lastSuccessfulSyncStarted`). Grep `adapter.state.lastSyncStarted`/`lastSuccessfulSyncStarted` reads/writes, `AdapterState<`, and `ToDevRev` usages — in `src` AND `test`.

**Transform:**
1. If the State interface mixes in SDK-owned fields (`toDevRev`/`fromDevRev`/`workers*`/`snapInVersionId`), REMOVE them from the interface and `getInitialState` (SDK-managed via `adapter.sdkState`).
2. `AdapterState<S>`: as a bare annotation, replace with the connector's own `State` type — do NOT just delete (a param `state?: AdapterState<S>` → `state?: State`, not `state?:`). Drop the `AdapterState` import.
3. Cursor fields (`lastSyncStarted`/`lastSuccessfulSyncStarted`): apply the **decision rule** (see §13). RENAME (declared) vs DELETE/repoint (SDK-supplied).
4. Rename a top-level connector state key literally named `connectorState`/`sdkState` (collides with envelope detection) before relying on migration.
5. **Propagate every rename + `AdapterState` replacement into `test/**`** — fixtures that construct state with the old/reserved key, or type it as `AdapterState`, break the test gate (hubspot).

**Pitfalls:** `AdapterState` as a param/field type dropped to `state?:` is invalid TS — replace, don't delete. Many connectors have zero SDK key names in their interface (verified no-op). Test fixtures are the most-missed propagation target.

---

## 13. incremental-window (semantic — log review entry)

**Detect:** `grep -rnE "lastSuccessfulSyncStarted|lastSyncStarted|workersNewest" src test`.

**DECISION RULE — is the cursor field declared in the connector's OWN State interface / getInitialState?**

- **NO** (accessed only as `adapter.state.<field>`, absent from the interface): it was SDK-supplied via v1 `AdapterState<T>` (removed in v2, and it is a hard TS2339 in v2 because `adapter.state` is now the connector type). **DELETE** a bare write; **repoint** a read to `adapter.event.payload.event_context.extract_from` (the semantic equivalent — the resolved window start; usually ALREADY destructured nearby for the entity filter). Do NOT rename (nothing to preserve). *(confluence)*
- **YES** (connector-declared, written and read by connector code, often distinct from `extract_from` which the connector consumes separately): **RENAME** off the reserved SDK key (e.g. `lastSuccessfulSyncStarted` → `lastSuccessfulWindowStart`) throughout the interface, `getInitialState`, all read/write sites, and test fixtures. Keep the mechanism. Substituting `extract_from` here would destroy the cursor; renaming is required because v2's v1-blob auto-migration STRIPS the reserved key. *(hubspot)*

**Before (NO — SDK-supplied)**
```ts
const lastSyncStarted = adapter.state.lastSuccessfulSyncStarted; // not in ConfluenceExtractorState
if (isIncrementalMode && lastSyncStarted && itemDate <= new Date(lastSyncStarted).getTime()) break;
```
**After**
```ts
const { extract_from } = adapter.event.payload.event_context;   // already in scope nearby
if (isIncrementalMode && extract_from && itemDate <= new Date(extract_from).getTime()) break;
```

**Before (YES — connector-declared)**
```ts
export interface ExtractorState { /* ... */ lastSuccessfulSyncStarted?: string; }
const cursor = adapter.state.lastSuccessfulSyncStarted;   // written elsewhere by connector code
```
**After**
```ts
export interface ExtractorState { /* ... */ lastSuccessfulWindowStart?: string; }
const cursor = adapter.state.lastSuccessfulWindowStart;
```

**Pitfalls:** the decision rule is load-bearing — getting it backwards produces **compiling-but-silently-broken** incremental sync (renaming an SDK-supplied field leaves the read never populated → full re-extract; substituting `extract_from` for a connector-owned cross-sync cursor destroys it). A sync in flight across the upgrade re-extracts ONCE then self-heals (platform dedupes). Some connectors already read `extract_from`/`extract_to`/`mode` and never touched the removed fields (verified no-op — don't invent a `workersNewest` read). Flag every touch; update paired tests (§16).

---

## 14. axios-removal (semantic — log review entry)

**Detect:** grep bare symbol names (NOT the specifier — step 1 rewrote it): `grep -rnE "\baxiosClient\b|serializeAxiosError|formatAxiosError|HTTPResponse" src test` and `grep -rnE "import \{[^}]*\baxios\b[^}]*\} from '@devrev/airsync-sdk'" src test`.

**Transform:**
1. `import { axios, <other root symbols> } from '@devrev/airsync-sdk'` → `import axios from 'axios';` PLUS keep the other symbols as a named import from `@devrev/airsync-sdk` (`ErrorRecord`/`EventType`/`SyncMode`/… are root exports — don't drop them).
2. `import { axiosClient }` → local client, keeping the name so call sites are untouched:
```ts
import axios from 'axios';
import axiosRetry from 'axios-retry';
const axiosClient = axios.create();
axiosRetry(axiosClient, { retries: 5, retryDelay: axiosRetry.exponentialDelay });
```
3. **`serializeAxiosError` — CONDITIONAL:**
   - result **spread/property-accessed as an object** (`{ ...serializeAxiosError(e) }`, `serializeAxiosError(e).message`) → KEEP it: `import { serializeAxiosError } from '@devrev/airsync-sdk/dist/logger/logger';` (it still exists internally in v2 and returns an object; it is NOT on the root barrel). Swapping to root `serializeError` here is a TS2698 "spread types may only be created from object types" error, because `serializeError` returns a STRING.
   - result used as a **string** (`console.error(serializeAxiosError(e))`, string concat) → swap to `serializeError` from the root barrel.
4. `formatAxiosError` → `serializeError` (root; string).
5. If `getAttachmentStream` annotated `httpStream` with `AxiosResponse` imported FROM the SDK, switch to `HttpStreamResponse` (root) or `import { AxiosResponse } from 'axios'`.
6. Add `axios` and `axios-retry` to `package.json` deps if missing.

**Before**
```ts
import { axios, axiosClient, serializeAxiosError } from '@devrev/ts-adaas';   // (post-step-1: airsync-sdk)
const res = await axiosClient.get(url, { responseType: 'stream' });
errorObj = { ...errorObj, ...serializeAxiosError(error) };   // object spread
```
**After**
```ts
import axios from 'axios';
import axiosRetry from 'axios-retry';
import { serializeAxiosError } from '@devrev/airsync-sdk/dist/logger/logger';   // KEPT — result is spread
const axiosClient = axios.create();
axiosRetry(axiosClient, { retries: 5, retryDelay: axiosRetry.exponentialDelay });
const res = await axiosClient.get(url, { responseType: 'stream' });
errorObj = { ...errorObj, ...serializeAxiosError(error) };
```

**Pitfalls:** the `serializeAxiosError`→`serializeError` swap is WRONG for object-spread sites (TS2698) — the #1 axios trap; detect the usage shape first. Mixed imports must preserve co-imported root symbols. The minimal local `axiosClient` DROPS the SDK client's custom `retryCondition` (exclude 429), retry logging, and `onMaxRetryTimesExceeded` (Authorization-header stripping) — fine for most connectors, but if the connector relied on that behavior, replicate it and flag. `axios-retry` is often a missing DIRECT dep. For jest: a source file and its test that both `jest.spyOn(axios,...)` must import `axios` from `'axios'` so the spy targets the same module instance. `HttpStreamResponse` (`{data,headers}`) is satisfied structurally by an axios stream response for a bare `{ httpStream }` object — BUT a connector-local alias like `NonNullable<ExternalSystemAttachmentStreamingResponse['httpStream']>` silently NARROWS from `AxiosResponse` to `{data;headers}`; a stream helper that builds a full `AxiosResponse`-shaped literal (config/status/statusText) then over-satisfies the narrower type harmlessly, but if it relies on the wider type elsewhere, retype it. Flag any local httpStream alias.

---

## 15. spawn-workerpath (mechanical → semantic when indirected)

**Detect:** `grep -rnE "workerPath\s*:" src` (distinguish `workerPathOverrides`, which is KEPT).

**Transform:**
- Literal: `workerPath: __dirname + '/workers/<phase>'` → `baseWorkerPath: __dirname`.
- **Variable/dispatcher form** (`workerPath: file` where `file` comes from a `switch`/helper like `getWorkerPerLoadingPhase(event)`): replace with `baseWorkerPath: __dirname` AND delete the now-dead dispatcher function, its `file`/`path` locals, and any imports it orphaned (`EventType`, etc.) — or `noUnusedLocals`/eslint fails.

**Before**
```ts
const file = getWorkerPerLoadingPhase(event);   // switch over EventType → path string
await spawn({ event, initialState, workerPath: file });
```
**After**
```ts
await spawn({ event, initialState, baseWorkerPath: __dirname });
// getWorkerPerLoadingPhase + its EventType import deleted
```

**Pitfalls:** the variable-indirection form leaves dead code that fails lint/tsc if you only swap the property (hubspot). Don't touch `workerPathOverrides`. Default worker filenames (`/workers/data-extraction`, `/workers/load-data`, …) are unchanged, so `baseWorkerPath: __dirname` resolves them. Many connectors already use `baseWorkerPath: __dirname` (verified no-op).

---

## 16. jest-mocks (semantic — log review entries)

**Detect:** `grep -rnE "jest.mock\('@devrev/airsync-sdk'|jest.requireActual\('@devrev/airsync-sdk'|processExtractionTask|processLoadingTask|processTask|adapter\.emit|mockAdapter\.emit|toHaveBeenCalledWith\(.*EventType|AdapterState|lastSuccessfulSyncStarted|lastSyncStarted" test src`. Also find worker tests that IMPORT the task fn directly (no `jest.mock`/processTask capture) and tests that invoke a helper directly.

**Transform — mechanical part (per file):**
- specifier already renamed (§1); `processTask`→`processExtractionTask`/`processLoadingTask` in import, mock factory, and the `X as jest.Mock` capture;
- drop `WorkerAdapter: {}` / `axiosClient: {}` keys from mock factories; remove vestigial `emit: jest.fn()` from mock adapters;
- `AirdropEvent`→`AirSyncEvent`; keep `requireActual` only for enums/constants still referenced (e.g. `AirSyncDefaultItemTypes`);
- propagate state-field RENAMES and `AdapterState`→`<ConnectorState>` into fixtures (§12/§13).

**Transform — semantic part (best-effort, flag each file):**
- `expect(adapter.emit).toHaveBeenCalledWith(EventType.X)` → assertion on the awaited RETURN of the captured task/onTimeout fn: `const result = await taskFn({ adapter }); expect(result).toEqual({ status: '...' })`. Same rewrite when a **helper is invoked directly** (`ErrorHandler.handleExtractionError(...)` now returns a `TaskResult`), not only via `mockProcessTask.mock.calls[0][0].task`.
- change captured `taskFn` type `Promise<void>` → `Promise<TaskResult>`;
- pass-through loaders → assert the task returns the `streamAttachments`/`loadAttachments` mock value;
- `new Mappers({ event })` in source → add `Mappers: jest.fn().mockImplementation(() => ({ getByExternalId: jest.fn()... }))` to the mock factory; unwrap mapper test doubles (§11);
- source moved to `import axios from 'axios'` → replace SDK-axios mock with `jest.mock('axios')` (+ `jest.mock('axios-retry')` if a retry client is built);
- ESU Case-B tests → give the mock adapter `initializeRepos`/`getRepo`, add `AirSyncDefaultItemTypes`, assert repo push + `{status:'success'}` return.

**Before**
```ts
import { processTask, ExtractorEventType } from '@devrev/airsync-sdk';
jest.mock('@devrev/airsync-sdk', () => ({ processTask: jest.fn(), ExtractorEventType: jest.requireActual('@devrev/airsync-sdk').ExtractorEventType, WorkerAdapter: {} }));
const mockProcessTask = processTask as jest.Mock;
await mockProcessTask.mock.calls[0][0].task({ adapter });
expect(adapter.emit).toHaveBeenCalledWith(ExtractorEventType.DataExtractionDone);
```
**After**
```ts
import { processExtractionTask } from '@devrev/airsync-sdk';
jest.mock('@devrev/airsync-sdk', () => ({ processExtractionTask: jest.fn() }));
const mockProcessTask = processExtractionTask as jest.Mock;
const result = await mockProcessTask.mock.calls[0][0].task({ adapter });
expect(result).toEqual({ status: 'success' });
```

**Pitfalls:** biggest, most error-prone test change. Enum string values are byte-identical, so mock enum values rarely need edits — the work is the processTask rename + emit→return assertion rewrite + fixture key renames. `delaySeconds` (not `delay`) in expected `{status:'delay'}` objects. Tests that assert a deleted enum member or `UnknownEventType` switch to the raw string. Direct-import worker tests and directly-invoked helper tests are easy to miss (they lack the `mockProcessTask` capture shape). Flag every rewritten test file.

---

## Review triggers (always add a MIGRATION_REVIEW.md entry)

- Incremental-window decision (RENAME vs DELETE/repoint) — record which branch fired and WHY (field declared in State interface? written by connector code?), and the one-time re-extract edge.
- State-interface key COLLISION renamed (connector's own `lastSyncStarted`/`lastSuccessfulSyncStarted`/`connectorState`/`sdkState`) — highest data-loss risk; record old→new names and every touched site incl. tests.
- State interface that MIXED SDK-owned fields removed; `AdapterState<S>` replaced with the connector State type.
- emit buried in a shared void/boolean helper (multi-emit downgraded to log-and-continue) OR in class instance methods (boolean-abort → TaskResult bubbling/stored-result).
- emit-in-loop with a possibly-undefined error where a `?? { message }` fallback was synthesized; a `Done`+error-summary mapped to success + surfaced error.
- loadItemTypes/loadAttachments defensive try/catch kept vs collapsed; a loader that augments `reports` (pushed onto `adapter.reports` instead of destructuring the return); dropped success-side side effect.
- mappers-unwrap that changed a hand-rolled type + read site + test doubles; any `new Mappers({event})` hoisted out of a loop.
- onTimeout with a side-effecting body preserved (not omitted); resumable-vs-non-resumable classification judgement.
- ESU inline→repo rewrite (added EXTERNAL_SYNC_UNITS repo) and its hand-written test rewrite.
- axios-removal: local `axios.create()`+`axiosRetry` built (record retry config vs SDK client's dropped behavior); `serializeAxiosError` kept-via-deep-import (object-spread) vs swapped to `serializeError` (string); `axios-retry` added; local `httpStream` type alias retyped.
- spawn workerPath variable/dispatcher form → dead dispatcher + orphaned imports removed.
- `*.UnknownEventType` mapped to raw `'UNKNOWN_EVENT_TYPE'` (the enum members are removed).
- `CustomAirdropEvent` dropped or rebased (esp. if it added fields beyond the five identity fields).
- Any jest test file whose assertions moved from `expect(adapter.emit).toHaveBeenCalledWith(...)` to a TaskResult return assertion, or where an SDK-supplied mock (axios/Mappers) moved to a direct module mock, or a directly-invoked helper's assertions were rewritten.
- Any rewrite applied with low confidence or an ambiguous judgment call.
