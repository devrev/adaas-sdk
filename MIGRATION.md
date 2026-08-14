# Migrating connectors from v1 (`@devrev/ts-adaas`) to v2 (`@devrev/airsync-sdk`)

Covers every connector-facing breaking change between `@devrev/ts-adaas` v1.x
and `@devrev/airsync-sdk` v2.0.0, with before/after examples from real
connectors. Self-contained: the numbered sections, applied **in order** (see
execution plan), are the complete migration — executable top to bottom without
any other reference. It ships in the npm package, so after installing v2 the
version-matched copy is at `node_modules/@devrev/airsync-sdk/MIGRATION.md`.

**The wire protocol is unchanged.** Event payloads, API routes, headers, the
artifact/upload flow, and every surviving event-type **string value** are
byte-for-byte identical to v1. Only the connector-facing **TypeScript API**
changed.

> **Why a hard break with no deprecation shims?** v2 is a single bundled-pain
> major: the package was renamed, so there are no existing consumers to keep
> backward-compatible. Everything changed at once in one guide.

---

## TL;DR — what breaks

| # | Change | Who it affects |
|---|--------|----------------|
| 1 | Package renamed `@devrev/ts-adaas` → `@devrev/airsync-sdk` | every import |
| 2 | `AirdropEvent` → `AirSyncEvent`, `AirdropMessage` → `AirSyncMessage` | type annotations (all connectors) |
| 3 | `processTask` → `processExtractionTask` / `processLoadingTask` | every worker file |
| 4 | `adapter.emit(...)` is gone — tasks **return** a `TaskResult` instead | every worker file |
| 5 | `WorkerAdapter` **class** removed → `ExtractionAdapter` / `LoadingAdapter` | helper signatures |
| 6 | `loadItemTypes` / `loadAttachments` / `streamAttachments` now **return** a `TaskResult` | loading + attachment workers |
| 7 | `EventData.external_sync_units` **removed** — external sync units must be pushed to a repo | ESU workers |
| 8 | `adapter.state` is connector-state only; SDK fields readable via `adapter.sdkState`. `lastSyncStarted` / `lastSuccessfulSyncStarted` **removed** | connectors reading/writing SDK bookkeeping |
| 9 | `axios`, `axiosClient`, `formatAxiosError`, `serializeAxiosError`, `HTTPResponse` no longer exported | anyone importing the SDK's HTTP/axios surface |
| 10 | `Mappers` methods return the unwrapped body (`Promise<T>`), not `Promise<AxiosResponse<T>>` | loaders calling `adapter.mappers.*` |
| 11 | Deprecated v1 modules deleted (`Adapter`, `createAdapter`, `DemoExtractor`, `HTTPClient`, `defaultResponse`, deprecated `Uploader`) | only legacy code |
| 12 | Deprecated event-type enum **members** deleted; deprecated types/enums (`ExtractionMode`, `EventContextIn`/`Out`, `DomainObjectState`, `ErrorLevel`, `LogRecord`, `AdapterUpdateParams`, `AdapterState`) **removed**; internal worker-IPC types (`WorkerEvent`, `WorkerMessageSubject`, `WorkerMessage*`, `WorkerData`, `GetWorkerPathInterface`) off the root barrel | only if you used the old members/types or the internal IPC types |
| 13 | Several deep `dist/**` import paths moved/removed | deep-importers |
| 14 | Legacy `string[]` attachment-dedup migration dropped | in-flight attachment syncs started on SDK **< 1.15.2** |
| 15 | `spawn`'s deprecated `workerPath` option **removed** — use `baseWorkerPath: __dirname` | connectors still passing `workerPath` |
| 16 | Jest mocks of the SDK hardcode the v1 shape; emit-called assertions become return-value assertions | every test suite mocking the SDK |

(Also: `EventData.progress` was removed — a no-op since v1; the backend computes
progress. Covered with the other `EventData` removals in §12.)

(Also: emitted logs no longer carry the `is_sdk_log` field — an
observability-only change that breaks no connector code; see §12.)

What does **not** change: `spawn(...)` and its surviving options (`initialState`,
`initialDomainMapping`, `workerPathOverrides`, `baseWorkerPath`,
`options.batchSize`, `timeout`, `isLocalDevelopment`, …) — the one exception is
the long-deprecated `workerPath`, removed (§15); default worker paths
(`/workers/data-extraction`, etc.); repos (`initializeRepos`, `getRepo`,
`push`); the normalization interfaces (`NormalizedItem`, `NormalizedAttachment`,
`RepoInterface`, `ExternalSyncUnit`); `installInitialDomainMapping`;
`createMockEvent` / `MockServer`; HTTP retry behavior;
`event_context.extract_from` / `extract_to`; and every surviving event-type
string value on the wire.

### Execution plan (for migrating a whole connector in one pass)

Apply sections **in numbered order** — later ones assume earlier ones ran (e.g.
§3–§6 rewrite emit sites that §5's adapter types must already annotate). For each
section: search the whole connector — source **and** tests — apply every hit,
then move on. Verify at the end, not per-section (a half-applied section never
compiles). Two search rules:

- **After §1, the old specifier is gone.** Every later search must target the new
  `@devrev/airsync-sdk` specifier or a bare symbol name (`\bWorkerAdapter\b`,
  `\baxiosClient\b`, `\.emit\(`, `lastSuccessfulSyncStarted`, …) — searching
  `@devrev/ts-adaas` after §1 finds nothing and makes a section look like a false
  no-op.
- **A section with zero hits is a verified no-op** — confirm and move on; many
  connectors already use `baseWorkerPath`, push ESUs to a repo, and have no deep
  imports.
- **Don't narrate the migration in code.** The `// v1` / `// v2` labels here are
  reading aids — never copy them into the connector. Apply each edit cleanly, no
  comment explaining what changed. Add a comment only where the resulting logic
  is genuinely non-obvious independent of this migration.

Final verification, from the connector's package dir: `npm install` (regenerates
the lockfile), `npx tsc --noEmit`, `npm run lint` (unused imports/locals orphaned
by rewrites fail here — clean them up), `npm run build`, and the repo's test
command if tests exist. A leftover `adapter.emit`, a removed symbol, a missing
`delaySeconds`, a destructured `{ reports }`, or an un-renamed test fixture is
the usual failure cause.

---

## 1. Package rename

```bash
npm uninstall @devrev/ts-adaas
npm install @devrev/airsync-sdk@beta
```

> Until GA ships, install via the **`beta` dist-tag** — it always resolves to the
> newest published 2.x beta. A plain `npm install @devrev/airsync-sdk` may resolve
> an older beta, and `@2.0.0` does not exist yet and 404s. Once GA is published,
> plain install (`@latest`) is correct.

> **Start from the latest stable v1.** This guide describes the delta from the
> latest stable `@devrev/ts-adaas` (1.x). If your connector is on an older 1.x
> that skipped an intra-v1 migration, do that first so the examples match your
> code. Check **https://github.com/devrev/adaas-sdk/releases** for any release
> between your version and latest whose notes call out a migration or breaking
> change (the last such were **1.18.0**, **1.17.0**, **1.16.0**; **1.19.0 →
> 1.20.0** were migration-free). Bring the connector to a green latest-stable v1
> build before starting.

Then global-replace the import specifier **everywhere the string appears**: every
import, every `jest.mock('...')` / `jest.requireActual('...')` first argument, and
any jest `moduleNameMapper`. This also rewrites deep-import path prefixes
(`@devrev/ts-adaas/dist/x` → `@devrev/airsync-sdk/dist/x`); §13 handles the paths
that moved. Do not rename any symbols in this step.

```ts
// v1
import { spawn, EventType } from '@devrev/ts-adaas';
// v2
import { spawn, EventType } from '@devrev/airsync-sdk';
```

> **Deep imports** like `@devrev/ts-adaas/dist/...` are fragile — several paths
> moved or were removed in v2 (§13). Prefer root imports; the v2 barrel now exports
> several symbols that previously required a deep import (`Mappers`, `Item`,
> `ItemTypeToLoad`).

## 2. Type renames: `AirdropEvent` → `AirSyncEvent`

Hard rename, no compatibility alias. The payload **shape** is identical — only the
type name changed.

| v1 | v2 |
|----|----|
| `AirdropEvent` | `AirSyncEvent` |
| `AirdropMessage` | `AirSyncMessage` |

E.g. `(events: AirdropEvent[])` → `(events: AirSyncEvent[])`.

No other public type was renamed — `ConnectionData`, `EventContext`, `EventData`,
`ExtractorEvent`, and `ExternalSyncUnit` keep their v1 names. Platform-owned
strings (`/internal/airdrop.*` routes, the `'ADaaS'` external system type, the
`adaas_library_version` metadata key, `airdrop_*` mapping enum values) are
intentionally unchanged.

### `AirSyncEvent.context` gained identity fields

`AirSyncEvent.context` now declares the identity fields the platform already
sends, in addition to `secrets`, `snap_in_id`, `snap_in_version_id`:

```ts
// v2 — AirSyncEvent.context
context: {
  secrets: { service_account_token: string };
  snap_in_version_id: string;
  snap_in_id: string;
  user_id: string;            // new
  dev_oid: string;            // new
  source_id: string;          // new
  service_account_id: string; // new
};
```

If you previously extended the event to read these (e.g. a hand-rolled
`CustomAirdropEvent` that added `user_id`), drop the extension and read
`adapter.event.context.user_id` directly. (`snap_in_id` was already in v1; only
the four fields above are new.)

> Note: these four fields live on the **top-level** `AirSyncEvent.context`, not on
> the `EventContext` inside `payload.event_context` (a different, unchanged
> object).

## 3 + 4. The new worker contract: **return a `TaskResult`** instead of emitting

The core change of v2. In v1 the connector decided *which event* to emit and
called `adapter.emit(...)`. In v2 it only reports *how the phase ended* by
**returning** a `TaskResult`; the SDK maps it to the correct platform event for
the current phase and emits it exactly once.

```ts
// the exact union (exported from @devrev/airsync-sdk)
export type TaskResult =
  | { status: 'success' }
  | { status: 'progress' }
  | { status: 'delay'; delaySeconds: number }   // note: delaySeconds, not delay
  | { status: 'error'; error: ErrorRecord };    // ErrorRecord = { message: string }
```

`processTask` is split into two typed entry points — pick the one matching the
worker's phase. Phase is per-file: workers under `extraction/` (or whose body uses
`initializeRepos`/`getRepo`/`streamAttachments`) are extraction; workers under
`loading/` (or using `loadItemTypes`/`loadAttachments`/`mappers`) are loading.

### Before (v1)

```ts
import { processTask, ExtractorEventType } from '@devrev/ts-adaas';

processTask({
  task: async ({ adapter }) => {
    // ... extract ...
    await adapter.emit(ExtractorEventType.DataExtractionDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.postState();
    await adapter.emit(ExtractorEventType.DataExtractionProgress, { progress: 50 });
  },
});
```

### After (v2)

```ts
import { processExtractionTask } from '@devrev/airsync-sdk';

processExtractionTask({
  task: async ({ adapter }) => {
    // ... extract ...
    return { status: 'success' };
  },
  // onTimeout can be omitted entirely for resumable phases:
  // the SDK emits a progress (continuation) result by default.
});
```

Loading workers use `processLoadingTask` the same way.

> `adapter.emit(...)` is now **`protected`** — calling `adapter.emit(...)` or
> `this.adapter.emit(...)` is a hard **compile error** in v2, not a deprecation.
> Every emit site must be converted.

### `emit()` → `return` translation table

| v1 emit call | v2 return |
|--------------|-----------|
| `await adapter.emit(XxxDone)` | `return { status: 'success' }` |
| `await adapter.emit(XxxProgress, { progress })` | `return { status: 'progress' }` |
| `await adapter.emit(XxxDelayed, { delay })` | `return { status: 'delay', delaySeconds: delay }` |
| `await adapter.emit(XxxError, { error })` | `return { status: 'error', error }` |
| `await adapter.emit(ExternalSyncUnitExtractionDone, { external_sync_units })` | push to repo + `return { status: 'success' }` — see §7 |
| `await adapter.emit(MetadataExtractionDone, { pre_extraction_item_counts })` | `adapter.preExtractionItemCounts = [...]` + `return { status: 'success' }` |

`pre_extraction_item_counts` (added in v1 1.20.2-beta.0) is set on the adapter
during the metadata phase; the SDK attaches it to the metadata-done event.
`ItemTypeCount` and `ItemInputType` are unchanged and still exported.

`progress` (`{ progress: n }`) carried no semantic value in v1 beyond "not done
yet" and is dropped; the platform tracks progress itself.

> **A `Done` emit that carried a non-fatal error summary** (v1
> `emit(XxxDone, { error })` — "finished, but here's what went wrong") maps to
> `return { status: 'success' }` plus surfacing the error some other way (a report
> entry or `console.warn`) — **not** to `{ status: 'error' }`, which would emit
> `*Error` and flip a successful phase to failed.

> **`ProcessTaskInterface` / `TaskAdapterInterface` changed their generic.** Both
> survive, but the type parameter now names the **adapter**, not the connector
> state: v1 `ProcessTaskInterface<State>` / `TaskAdapterInterface<State>` → v2
> `ProcessTaskInterface<ExtractionAdapter<State>>` (or `LoadingAdapter<State>`),
> same for `TaskAdapterInterface`. A bare `<State>` compiles in loosely-typed
> spots but silently types `adapter` as the connector state. `onTimeout` is now
> optional, and both callbacks return `Promise<TaskResult>` not `Promise<void>`.

### Status → emitted event, per phase

The SDK picks the platform event from the **current phase** and the returned
status:

| status | Resumable phases — data/attachment **extraction**, data/attachment **loading** | Non-resumable — external sync units, metadata, state deletion |
|--------|------------------------------------------------------------------------------|---------------------------------------------------------------|
| `'success'` | `*Done` | `*Done` |
| `'progress'` | `*Progress` (continuation) | **`*Error`** (illegal for these phases; emitted with a generated message) |
| `'delay'` | `*Delayed` (with `delaySeconds`) | **`*Error`** (illegal) |
| `'error'` | `*Error` (with the error record) | `*Error` |

### Emits buried inside helper functions

A common v1 pattern: emit deep inside a helper, return a boolean telling the
caller to stop. Since only the **task's return value** reaches the SDK in v2, the
helper must **bubble the outcome up**.

A clean way (used by the migrated google-drive connector): store the terminal
result on a field and return it once the loop unwinds:

```ts
// v1 — helper emits, returns false to abort
private async handlePermissionDeniedError(error: unknown) {
  await this.adapter.emit(ExtractorEventType.DataExtractionError, {
    error: { message: '...' },
  });
}
```

```ts
// v2 — helper records the result; the task returns it
private result: TaskResult | undefined;

private handlePermissionDeniedError(error: unknown) {
  this.result = { status: 'error', error: { message: '...' } };
}

// ... and where the loop ends:
private finalResult(): TaskResult {
  // a stored error/delay set by a helper, else progress (continuation)
  return this.result ?? { status: 'progress' };
}
```

For a simple "stop iterating" signal, return the `TaskResult` directly up the call
chain:

```ts
// v2
async function extractList(adapter: ExtractionAdapter<State>): Promise<TaskResult | null> {
  if (rateLimited) return { status: 'delay', delaySeconds: retryAfter };
  // ...
  return null; // keep going
}

processExtractionTask<State>({
  task: async ({ adapter }) => {
    for (const itemType of itemTypes) {
      const stop = await extractList(adapter);
      if (stop) return stop;
    }
    return { status: 'success' };
  },
});
```

### Timeout handling

Checking `adapter.isTimeout` in your extraction loop still works as in v1 — but
instead of emitting progress and exiting, **return** progress:

```ts
if (adapter.isTimeout) {
  return { status: 'progress' }; // platform sends CONTINUE_* next
}
```

Two behaviors matter when migrating:

- **The timeout outcome always wins.** Once the soft timeout fires, the SDK emits
  the `onTimeout` result (or its default) and **ignores whatever the task
  returned** — a phase that ran out of time must hand off for continuation, not
  report itself complete.
- **Omit `onTimeout` unless it does real work.** Its default is phase-aware:
  `progress` (continuation) for resumable phases, a timeout **error** for
  non-resumable ones (external sync units, metadata, state deletion) where
  continuation is impossible. So a v1 `onTimeout` that only emitted the
  phase-appropriate event (optionally after `postState()`) is now redundant —
  **delete it**. Keep an explicit `onTimeout` only when its v1 body did real work
  that must survive a timeout (cancelling rate limiting, clearing upload
  bookkeeping, a custom error message) — preserve that body, replacing the
  trailing emit with a returned `TaskResult`:

  ```ts
  onTimeout: async () => ({
    status: 'error',
    error: { message: 'Custom timeout message.' },
  }),
  ```

> Do **not** call `process.exit()` yourself in v2 — the SDK owns the single worker
> exit after it emits your `TaskResult`. Likewise drop `adapter.postState()` inside
> `onTimeout`; the SDK persists state around the timeout emit.

## 5. `WorkerAdapter` → `ExtractionAdapter` / `LoadingAdapter`

The `WorkerAdapter` **class** is gone. Replace the type annotation on your helpers
with the mode-specific adapter:

```ts
// v1
async function extractList(adapter: WorkerAdapter<State>) { ... }
// v2
import { ExtractionAdapter } from '@devrev/airsync-sdk';
async function extractList(adapter: ExtractionAdapter<State>) { ... }
```

| Surface | Lives on |
|---------|----------|
| `initializeRepos`, `getRepo`, `streamAttachments`, `shouldExtract`, `artifacts` | `ExtractionAdapter` |
| `loadItemTypes`, `loadAttachments`, `mappers`, `reports`, `processedFiles` | `LoadingAdapter` |
| `event`, `state`, `sdkState`, `postState`, `isTimeout`, `extractionScope` | both (shared `BaseAdapter`) |

> Only the **class** was removed. The **types** `WorkerAdapterInterface` and
> `WorkerAdapterOptions` still exist and are still exported — don't blindly rename
> every `WorkerAdapter` token; replace the `WorkerAdapter<T>` annotations and
> `new WorkerAdapter(...)` constructions only.

### Hand-constructed adapters (integration tests)

Some connectors construct the adapter directly in integration tests
(`new WorkerAdapter({ event, adapterState })`). The same construction works with
the phase-specific classes — but `adapterState` must be a v2 state class, which
replaced the v1 `State` class / `createAdapterState` factory (both removed; §13
for the import path):

```ts
// v1
const adapterState = new State({ event, initialState });
const adapter = new WorkerAdapter({ event, adapterState });

// v2 — same shape, phase-specific classes
import { LoadingState } from '@devrev/airsync-sdk/dist/state/state';
const adapterState = new LoadingState({ event, initialState });
const adapter = new LoadingAdapter({ event, adapterState });
```

Sync `new State(...)` maps to sync `new ExtractionState(...)` /
`new LoadingState(...)` (same `{ event, initialState, initialDomainMapping?,
options? }` params). The async `createAdapterState(...)` (fetched persisted state)
maps to the async `createExtractionState(...)` / `createLoadingState(...)`
factories at the same import path. A test that poked SDK fields via
`adapterState.state = { fromDevRev: ... }` must move them onto the `sdkState`
envelope (§8).

> **`mappers` / `reports` / `processedFiles` moved to `LoadingAdapter` only.** In
> v1 they were on the single `WorkerAdapter`, reachable in any phase. In v2 they
> are not on `ExtractionAdapter`. Code that touched `adapter.mappers` (etc.)
> during an extraction phase must move to the loading path.

## 6. Loading & attachment methods return a `TaskResult`

`loadItemTypes`, `loadAttachments`, and `streamAttachments` no longer emit or exit
mid-flight — they **return** a `TaskResult` you pass straight through. Rate limits
(→ `delay`), timeouts (→ `progress`), errors (→ `error`), completion (→ `success`)
are all encoded in the result; `reports` / `processed_files` (loading) and
artifacts (extraction) are attached to the emitted event automatically.

### Loading — before (v1)

```ts
import { LoaderEventType, processTask } from '@devrev/ts-adaas';

processTask({
  task: async ({ adapter }) => {
    await adapter.loadItemTypes({ itemTypesToLoad });
    await adapter.emit(LoaderEventType.DataLoadingDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.postState();
    await adapter.emit(LoaderEventType.DataLoadingProgress);
  },
});
```

### Loading — after (v2)

```ts
import { processLoadingTask } from '@devrev/airsync-sdk';

processLoadingTask({
  task: async ({ adapter }) => {
    return adapter.loadItemTypes({ itemTypesToLoad });
  },
});
```

### Attachment streaming — before (v1)

```ts
const response = await adapter.streamAttachments({ stream: getFileStream, batchSize: 50 });
if (response?.delay) {
  await adapter.emit(ExtractorEventType.AttachmentExtractionDelayed, { delay: response.delay });
} else if (response?.error) {
  await adapter.emit(ExtractorEventType.AttachmentExtractionError, { error: response.error });
} else {
  await adapter.emit(ExtractorEventType.AttachmentExtractionDone);
}
```

### Attachment streaming — after (v2)

```ts
return adapter.streamAttachments({ stream: getFileStream, batchSize: 50 });
```

> **Never destructure the returned `TaskResult`.** The union has **no** `reports` /
> `processed_files` members, so v1 code like
> `const { reports, processed_files } = await adapter.loadAttachments(...)` — or
> pushing a synthetic report into the returned array — is a compile error. A
> connector that augmented the reports pushes onto the **live getter before**
> returning instead:
>
> ```ts
> adapter.reports.push(buildNotesReport(...));
> return await adapter.loadAttachments({ create });
> ```
>
> A defensive outer try/catch with bespoke rate-limit handling can stay:
> `return await adapter.loadItemTypes(...)` in the `try`, map escaped throws to
> `{ status: 'delay' | 'error' }` in the `catch`.

Custom attachment processors (reducer/iterator) keep the same call signatures;
only their `adapter` parameter type changes from `WorkerAdapter<C>` to
`ExtractionAdapter<C>` (§5). The `getAttachmentStream` function you implement still
returns `{ httpStream }` / `{ delay }` / `{ error }` — but see §9 for the
`httpStream` type change.

## 7. External sync units go through a repo

In v1 the SDK accepted `external_sync_units` in emit data and uploaded them
internally. With emit gone, push them to the `EXTERNAL_SYNC_UNITS` repo yourself.
The `EventData.external_sync_units` field — deprecated in v1 — is **removed
entirely** in v2: there is no inline ESU path, and any code still referencing
`external_sync_units` in emit data is now a compile error. External sync units
leave the worker only as repo artifacts.

### Before (v1)

```ts
await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone, {
  external_sync_units: externalSyncUnits,
});
```

### After (v2)

```ts
import { AirSyncDefaultItemTypes, processExtractionTask } from '@devrev/airsync-sdk';

adapter.initializeRepos([
  {
    itemType: AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS,
    // mirror the batching the v1 SDK used internally for ESUs
    overridenOptions: { batchSize: 25000, skipConfirmation: true },
  },
]);
await adapter.getRepo(AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS)?.push(externalSyncUnits);

return { status: 'success' };
```

The repo is uploaded automatically before the `Done` event is emitted.

> If your connector already pushed ESUs to a repo in v1 (some do), this section is
> a no-op — just convert the trailing emit to `return`.

## 8. State split: `adapter.state` vs `adapter.sdkState`

In v1, connector state and SDK bookkeeping lived in one flat blob and
`adapter.state` exposed both. In v2:

- **`adapter.state` is connector state only** — exactly the shape of the
  `initialState` you pass to `spawn`. Getter and setter both survive, so in-place
  reads/writes work unchanged:

  ```ts
  // works identically in v1 and v2
  adapter.state[itemType].cursor = nextCursor;
  adapter.state[itemType].complete = true;
  ```

- **SDK bookkeeping** (`workersOldest`/`workersNewest`, `pendingWorkers*`,
  `toDevRev`, `fromDevRev`, `snapInVersionId`) moved to **`adapter.sdkState`**
  (read-only getter).
- On disk, state is persisted as a `{ connectorState, sdkState }` envelope. The SDK
  **migrates a v1 flat blob automatically on first read** (recognized SDK keys
  split into `sdkState`, the rest into `connectorState`), so in-flight syncs
  survive the upgrade.

> **`lastSyncStarted` / `lastSuccessfulSyncStarted` are gone.** Both were
> `@deprecated` in v1 and are **removed from `SdkState` in v2** — the SDK no longer
> sets, reads, or declares them. They were wall-clock sync-start timestamps; the
> SDK now resolves the incremental window from extraction-data boundaries instead
> (`workersOldest`/`workersNewest` and the resolved `extract_from`/`extract_to`).
> The two old key names are still recognized as SDK-owned by the v1-blob migration,
> so they route into `sdkState` (where they sit unused) rather than leaking into
> your connector state.

### If your v1 connector mixed SDK fields into its own `State` interface

Some connectors declared SDK-owned fields (e.g. `toDevRev`,
`lastSuccessfulSyncStarted`) on their hand-written `State` type and seeded them in
`getInitialState()`. Remove those — `toDevRev`/`fromDevRev`/`workers*` are
SDK-managed now, and `lastSyncStarted`/`lastSuccessfulSyncStarted` no longer exist
at all:

```ts
// v1 — State interface mixing SDK fields (remove these)
export interface State {
  // ... your fields ...
  lastSyncStarted?: string;          // removed in v2 — no replacement field
  lastSuccessfulSyncStarted?: string; // removed in v2 — read workersNewest / extract_to instead
  toDevRev?: ToDevRev;          // also drop the dist/state/state.interfaces import
}
```

### Cursor decision rule: rename vs repoint

For `lastSyncStarted` / `lastSuccessfulSyncStarted` specifically, what to do
depends on **whether the field is declared in your own `State` interface /
`getInitialState`** — getting this backwards compiles but silently breaks
incremental sync:

- **Not declared** (only accessed loosely as `adapter.state.<field>`, absent from
  your interface): it was SDK-supplied via the removed v1 `AdapterState<T>`, and
  the access is now a hard type error. **Delete** a bare write; **repoint** a read
  to `adapter.event.payload.event_context.extract_from` (the resolved window start
  — usually already destructured nearby). There is no field to preserve, so do not
  rename.
- **Declared** (your connector writes and reads it as its own cross-sync cursor,
  often consuming `extract_from` separately): **rename** it off the reserved SDK
  key (e.g. `lastSuccessfulSyncStarted` → `lastSuccessfulWindowStart`) throughout
  the interface, `getInitialState`, all read/write sites, and test fixtures. The
  rename is mandatory because the v1-blob auto-migration routes the reserved key
  into `sdkState` — a connector-owned cursor left on that name would be stripped
  from your state. Substituting `extract_from` here would destroy the cursor
  mechanism.

### Reading the incremental-sync window

In v1 you read `lastSuccessfulSyncStarted` to decide an incremental cursor. That
field is gone (above). Read the window the SDK resolves for you instead:

```ts
// preferred — the resolved window for this invocation, on the event context
const { extract_from, extract_to } = adapter.event.payload.event_context;

// the persisted cross-sync high-water mark (committed at end of each cycle)
const lastExtractedTo = adapter.sdkState.workersNewest;
```

`extract_from`/`extract_to` are the per-invocation window the SDK computes from the
platform's `extraction_start_time`/`extraction_end_time`;
`workersOldest`/`workersNewest` are the persisted boundaries committed at the end
of a completed cycle — the true replacement for the old "last successful sync"
resume point.

> **`AdapterState<ConnectorState>` is removed.** The deprecated flat
> `ConnectorState & SdkState` alias no longer exists. If you annotated anything
> `AdapterState<S>`, drop the import — use your own connector `State` type for
> `adapter.state`, and read SDK fields from `adapter.sdkState` (or the event
> context). The v2 on-disk shape is the `AdapterStateEnvelope`
> (`{ connectorState, sdkState }`), which the SDK manages for you.

> **Edge regression (old in-flight incremental syncs):** the SDK used to fall back
> to `lastSuccessfulSyncStarted` when resolving a `WORKERS_NEWEST` window on state
> predating `workersNewest` (SDK **< 1.17.1**). With the field removed, that
> fallback is gone: such a window now resolves to the unbounded epoch, so an
> incremental sync still mid-flight across the upgrade re-extracts from the
> beginning **once**. The next completed cycle commits `workersNewest` and the sync
> self-heals; the platform deduplicates downstream. New syncs and any sync whose
> first full cycle completed on ≥ 1.17.1 are unaffected. Drain in-flight
> incremental syncs before upgrading if the one-time re-extract matters.

> **Edge case:** if your v1 connector state had a top-level key literally named
> `connectorState` or `sdkState`, the auto-migration mis-reads it (the envelope is
> detected by those key names). Rename such a key **before** upgrading.

## 9. HTTP / axios surface removed from the SDK

The SDK no longer re-exports any axios surface from its public entry point:

| v1 export | v2 |
|-----------|----|
| `axios` (raw instance) | **removed** — import `axios` in your connector |
| `axiosClient` (retry-wrapped instance) | **removed from the public API** (still exists internally, but not exported and not at the old deep path) |
| `formatAxiosError` | **removed** (deleted from source) |
| `serializeAxiosError` | **removed from the public API** — use `serializeError` |
| `HTTPResponse` | **removed** |

`axios` and `axios-retry` are still runtime **dependencies** of the SDK (so
they're available transitively), but you must construct your own client:

### Before (v1)

```ts
import { axios, axiosClient } from '@devrev/ts-adaas';

const res = await axiosClient.get(url, { responseType: 'stream' });
```

### After (v2)

```ts
import axios from 'axios';
import axiosRetry from 'axios-retry';

const axiosClient = axios.create();
axiosRetry(axiosClient, { retries: 5, retryDelay: axiosRetry.exponentialDelay });

const res = await axiosClient.get(url, { responseType: 'stream' });
```

Add `axios` and `axios-retry` to your `package.json` **dependencies** if missing —
`axios-retry` in particular is usually not yet a direct dependency. The minimal
client above does not replicate three behaviors of v1's public `axiosClient`:
(1) its retry condition excluded 429s (letting your rate-limit handling see them);
(2) it stripped the `Authorization` header from logged errors after max retries;
(3) it used a **1000 ms** exponential-backoff base
(`exponentialDelay(retryCount, error, 1000)` → ~2s, 4s, 8s, 16s, 32s), whereas
`axios-retry`'s bare `exponentialDelay` defaults to a 100 ms factor (~0.2s … 3.2s)
— 10× more aggressive. To match v1's backoff, pass the base explicitly:

```ts
axiosRetry(axiosClient, {
  retries: 5,
  retryDelay: (retryCount, error) =>
    axiosRetry.exponentialDelay(retryCount, error, 1000),
});
```

Replicate any of these only if your connector relied on the SDK client's behavior.

> If you previously deep-imported `@devrev/ts-adaas/dist/http/axios-client`, that
> path **no longer exists** (the file was renamed to `http/client` and is
> internal). Bring your own axios instance as above.

For error logging, replace `formatAxiosError` / `serializeAxiosError` with the
exported `serializeError`:

```ts
import { serializeError } from '@devrev/airsync-sdk';
console.error(serializeError(error));
```

> **`serializeAxiosError` is conditional on how you used the result.**
> `serializeError` returns a **string**; `serializeAxiosError` returned an
> **object**. Where the result was used as a string (logging, concatenation), swap
> to `serializeError`. Where it was **spread or property-accessed as an object**
> (`{ ...serializeAxiosError(e) }`, `serializeAxiosError(e).message`), swapping
> produces a TS2698 "spread types" error — instead keep the function via its deep
> path (it still exists internally and still returns the object):
> `import { serializeAxiosError } from '@devrev/airsync-sdk/dist/logger/logger';`

### `httpStream` type changed

The connector-implemented attachment-stream function returns
`ExternalSystemAttachmentStreamingResponse`, whose `httpStream` field changed from
axios's `AxiosResponse` to the new public `HttpStreamResponse`
(`{ data: any; headers: Record<string, any> }`). An axios stream response still
satisfies it structurally, but if you annotated the stream with `AxiosResponse`
imported *from the SDK*, switch to `HttpStreamResponse` (or import `AxiosResponse`
from `axios` directly).

> **`error.statusCode` dropped from the streaming response.** v1.20 briefly widened
> `ExternalSystemAttachmentStreamingResponse.error` to
> `ErrorRecord & { statusCode?: number }`; v2 narrows it back to a plain
> `ErrorRecord`. The SDK never read `statusCode`, so this only affects a
> `getAttachmentStream` that returned `{ error: { message, statusCode } }` — drop
> the extra property (TS excess-property checking will flag it). Encode retry
> timing via `{ delay }` instead.

## 10. `Mappers` methods return the unwrapped body

`Mappers.getByTargetId` / `getByExternalId` / `create` / `update` changed their
return type from `Promise<AxiosResponse<T>>` to `Promise<T>` — they now return the
response **body** directly. Drop the `.data` access:

### Before (v1)

```ts
const mapperResponse = await this.mappers.getByTargetId({ sync_unit, target });
const resolvedId = mapperResponse.data.sync_mapper_record.external_ids[0];
```

### After (v2)

```ts
const mapperResponse = await this.mappers.getByTargetId({ sync_unit, target });
const resolvedId = mapperResponse.sync_mapper_record.external_ids[0];
```

A **silent** change for code that reads `.data` (fails to type-check, or reads
`undefined` if loosely typed). `Mappers` is now also exported from the package
root, so you no longer need to deep-import it from `dist/mappers/mappers`.

Three places must change **together**, or the failure is silent at runtime:

1. the read site (drop `.data`, above);
2. any hand-rolled structural param type that wrapped the body in `data?:`;
3. **mapper test doubles** — `jest.fn().mockResolvedValue({ data: {
   sync_mapper_record: ... } })` must become `mockResolvedValue({
   sync_mapper_record: ... })`, or the migrated source reads `undefined` and the
   test fails. These test files often import nothing from the SDK, so a
   specifier-based search misses them — grep for `sync_mapper_record`.

> `mappers` lives on `LoadingAdapter` only (§5). Extraction-phase code that used
> `adapter.mappers` must construct its own instance —
> `new Mappers({ event: adapter.event })` (hoist it out of per-item loops).

## 11. Deleted legacy modules

Everything under the v1 `deprecated/` tree is gone:

| Removed | Replacement |
|---------|-------------|
| `Adapter`, `createAdapter` | `ExtractionAdapter` / `LoadingAdapter` + `processExtractionTask` / `processLoadingTask` |
| `DemoExtractor` | — (reference implementation only) |
| `HTTPClient`, `defaultResponse` | your own axios client (§9) |
| deprecated `Uploader` | repos (`initializeRepos` / `getRepo` / `push`) |

(The SDK has an internal `Uploader` class, but it was never part of the public API
in either version — the *public* v1 `Uploader` was the deprecated one.)

## 12. Deleted deprecated enum members, types & enums

The old/new duplicate enum members were collapsed; only the modern names remain.
**The string values of the surviving members are byte-identical to v1**, so nothing
changes on the wire — only the TypeScript member names.

> ⚠️ The **deleted** `EventType` / `ExtractorEventType` members carried
> *different, older* string values than their replacements (e.g. v1
> `ExtractionDataStart = 'EXTRACTION_DATA_START'` vs the surviving
> `StartExtractingData = 'START_EXTRACTING_DATA'`). The modern members already
> existed in v1 with the modern values, so survivors are wire-compatible — but a
> deleted member and its replacement did **not** share a value.

**`EventType` (incoming):**

| Deleted (v1 deprecated) | Use instead |
|--------------------------|-------------|
| `ExtractionExternalSyncUnitsStart` | `StartExtractingExternalSyncUnits` |
| `ExtractionMetadataStart` | `StartExtractingMetadata` |
| `ExtractionDataStart` | `StartExtractingData` |
| `ExtractionDataContinue` | `ContinueExtractingData` |
| `ExtractionDataDelete` | `StartDeletingExtractorState` |
| `ExtractionAttachmentsStart` | `StartExtractingAttachments` |
| `ExtractionAttachmentsContinue` | `ContinueExtractingAttachments` |
| `ExtractionAttachmentsDelete` | `StartDeletingExtractorAttachmentsState` |

**`ExtractorEventType` (outgoing):** the `Extraction*`-prefixed members
(`ExtractionDataDone`, `ExtractionDataDelay`, `ExtractionAttachmentsProgress`, …)
are deleted; use the `*Extraction*` members (`DataExtractionDone`,
`DataExtractionDelayed`, `AttachmentExtractionProgress`, …). In practice you'll
rarely reference `ExtractorEventType` at all in v2 — see §4.

**`LoaderEventType`:** the duplicate members `DataLoadingDelay` and
`AttachmentsLoading*` (plural) are deleted; use `DataLoadingDelayed` and
`AttachmentLoading*` (singular). These duplicates shared their survivors' string
value, so removing them is a pure source-name change.

> **No more incoming-event-type translation.** v1 shipped an `event-type-translation`
> module mapping legacy platform strings onto the modern enum members (and
> translating outgoing types). v2 removed it entirely and passes incoming
> `payload.event_type` through untouched. Any connector importing
> `translateIncomingEventType` / `translateOutgoingEventType` /
> `translateExtractorEventType` / `translateLoaderEventType` from the SDK will fail
> to compile — drop them; the platform sends modern strings.

### Removed `UnknownEventType` members

`UnknownEventType = 'UNKNOWN_EVENT_TYPE'` was declared on three enums in v1
(`EventType`, `ExtractorEventType`, `LoaderEventType`). All three copies are
**removed** in v2; the SDK's "unrecognized event" sentinel is now an internal,
un-exported constant with the same string value. If you matched on any enum
member, compare against the raw `'UNKNOWN_EVENT_TYPE'` string instead (the wire
value is unchanged).

### Removed deprecated types & enums

These were `@deprecated` in v1 and are **deleted from the public API** in v2. None
are referenced by the modern worker contract; each row gives the replacement (or
"no replacement" where the concept is gone):

| Removed | Replacement |
|---------|-------------|
| `ExtractionMode` (enum) | `SyncMode` (adds `LOADING` alongside `INITIAL`/`INCREMENTAL`) |
| `EventContextIn` (interface) | `EventContext` (the single, current event-context type) |
| `EventContextOut` (interface) | `EventContext` |
| `DomainObjectState` (interface) | — (no replacement; was an unused per-object state shape) |
| `ErrorLevel` (enum) | — (logger uses its own internal log level) |
| `LogRecord` (interface) | — (unused) |
| `AdapterUpdateParams` (interface) | — (unused) |
| `AdapterState<T>` (type alias) | your connector `State` for `adapter.state`; `adapter.sdkState` for SDK fields (§8) |

Also removed from `EventData`: the deprecated `external_sync_units` field (§7) and
the deprecated `progress` field (a no-op since v1 — the backend computes progress).
The `artifacts` field on `EventData` is **kept** — it is how the SDK attaches
uploaded repo artifacts (including external sync units) to the emitted event.

### Worker-thread IPC types no longer on the root barrel

The worker↔main-thread plumbing types are no longer exported from the package root.
They were never part of the connector-authoring surface — they describe the SDK's
internal `parentPort` message protocol — but v1's barrel re-exported them, so a
connector (usually a test simulating the protocol) could import them from
`@devrev/ts-adaas`. Now removed from the root: `WorkerEvent`,
`WorkerMessageSubject` (enums), `WorkerMessage`, `WorkerMessageEmitted`,
`WorkerMessageExit`, `WorkerMessageLog`, `WorkerMessageFailed`, `WorkerData`,
`GetWorkerPathInterface`. The declarations still exist internally (deep-importable
via `@devrev/airsync-sdk/dist/types/workers`), but treat them as SDK-internal — a
worker-protocol test should assert on the `TaskResult` your task returns (§4), not
on raw IPC messages. (`WorkerMessageLog` also dropped its `isSdkLog` field.)

> **Emitted logs dropped the `is_sdk_log` field (observability only).** v1 tagged
> every log line with `is_sdk_log: true | false` (SDK vs connector origin), driven
> by an `AsyncLocalStorage` log-context layer that v2 removed. v2's log JSON no
> longer contains `is_sdk_log`. **No connector code changes** — not a compile or
> runtime break — but any platform dashboard, monitor, or saved query filtering
> logs on `@is_sdk_log` silently stops matching. Update those filters (drop the
> facet, or distinguish origin another way) after connectors upgrade.

## 13. Deep-import paths that moved or broke

The compiled `dist/` mirrors `src/` 1:1, so a deep import works only if the source
file still lives at the same relative path. Status of the paths real connectors
used:

| Deep import | Status in v2 |
|-------------|--------------|
| `dist/http/axios-client` (`axiosClient`) | ❌ **broken** — file renamed to `http/client` and made internal. Bring your own axios (§9). |
| `dist/state/state` (`State`, `createAdapterState`) | ❌ **both symbols removed** — the module now exports `BaseState`, `ExtractionState`/`createExtractionState`, `LoadingState`/`createLoadingState`. Map sync `new State(...)` → sync `new ExtractionState(...)`/`new LoadingState(...)`; async `createAdapterState(...)` → the async `create*State(...)` factory (§5). |
| `dist/state/state.interfaces` (`ToDevRev`) | ⚠️ still resolves, but `ToDevRev` is SDK-internal now (§8) — **drop** the import, don't repoint it |
| `dist/mappers/mappers.interface` (singular) | ❌ **broken** — file renamed to `mappers.interfaces` (plural). The four `*Params` interfaces and the two `SyncMapperRecord*` enums are on the root barrel (prefer root); the four `*Response` interfaces, `SyncMapperRecord`, `SyncMapperRecordExternalVersion`, `UpdateSyncMapperRecordParams`, and `MappersFactoryInterface` are **not** — repoint those to `dist/mappers/mappers.interfaces`. |
| `dist/logger/logger` (`serializeAxiosError`) | ⚠️ resolves, symbol kept internally — see the conditional rule in §9 (keep the deep import for object use; root `serializeError` for string use) |
| `dist/repo/repo.interfaces` (`Item`) | ✅ resolves — but `Item` is now on the root barrel, prefer the root import |
| `dist/types/loading` (`ItemTypeToLoad`) | ✅ resolves — also now on the root barrel |
| `dist/mappers/mappers` (`Mappers`) | ✅ resolves — also now on the root barrel (and note the return-type change, §10) |
| `dist/types/extraction` (`InitialSyncScope`) | ✅ resolves — also on the root barrel |

**Recommended:** replace all deep `dist/**` imports with root imports. If a symbol
you need isn't on the root barrel, request it rather than deep-importing.

## 14. Edge regression: very old in-flight attachment syncs

In v1 the SDK migrated the legacy `string[]` form of the processed-attachments
dedup list (`lastProcessedAttachmentsIdsList`) to the current `{ id, parent_id }[]`
form on read. v2 removed that conversion.

The `string[]` form only exists in state written by SDK **< 1.15.2**. If an
attachment-extraction phase started on a pre-1.15.2 SDK and is **still mid-flight**
when the connector upgrades to v2, the v2 dedup check (`it.id === …`) won't match
the bare-string entries, so attachments already downloaded in that sync get
re-uploaded once. New syncs — and any sync started on ≥ 1.15.2 — are unaffected;
the platform deduplicates downstream, so the only cost is the wasted
re-download/upload on that one continuation.

If this matters for your deployment, drain in-flight attachment syncs before
upgrading.

## 15. `spawn`'s deprecated `workerPath` option removed

`SpawnFactoryInterface.workerPath` was `@deprecated` in v1 and is **removed** in v2.
Point `spawn` at your worker directory with `baseWorkerPath: __dirname` — the SDK
resolves the per-event worker file from there (`workerPathOverrides` still works
for custom paths).

### Before (v1)

```ts
spawn({ event, initialState, workerPath: __dirname + '/workers/data-extraction' });
```

### After (v2)

```ts
spawn({ event, initialState, baseWorkerPath: __dirname });
```

> **Indirected `workerPath`** (a variable fed by a `switch`/dispatcher helper like
> `getWorkerPerLoadingPhase(event)`): replace with `baseWorkerPath: __dirname`
> **and delete the now-dead dispatcher function**, its locals, and any imports it
> orphaned (`EventType`, …) — otherwise `noUnusedLocals`/lint fails.
> `workerPathOverrides` is unrelated and kept.

## 16. Jest mocks & test assertions

Tests are first-class migration targets — a source-only migration passes `tsc` but
fails the test gate. SDK-module mocks hardcode the v1 shape.

**Mechanical changes per test file:**

- The module specifier in `jest.mock('...')` / `jest.requireActual('...')` /
  `moduleNameMapper` was already renamed in §1. In mock factories: `processTask` →
  `processExtractionTask` / `processLoadingTask` (matching the worker under test,
  §3), including the `X as jest.Mock` capture.
- Drop `WorkerAdapter: {}` and `axiosClient: {}` keys from mock factories; remove
  vestigial `emit: jest.fn()` from mock adapters.
- `AirdropEvent` → `AirSyncEvent` in fixtures/annotations (§2). Keep
  `jest.requireActual` only for enums/constants still referenced.
- Propagate every state-field rename and `AdapterState` → your-State-type
  replacement into fixtures (§8) — fixtures are the most-missed target.

**Semantic changes:**

- `expect(adapter.emit).toHaveBeenCalledWith(EventType.X)` becomes an assertion on
  the awaited **return** of the captured task/onTimeout function:

  ```ts
  // v1
  await mockProcessTask.mock.calls[0][0].task({ adapter });
  expect(adapter.emit).toHaveBeenCalledWith(ExtractorEventType.DataExtractionDone);
  // v2
  const result = await mockProcessTask.mock.calls[0][0].task({ adapter });
  expect(result).toEqual({ status: 'success' });
  ```

  The same rewrite applies to tests that invoke a **helper directly** (the helper
  now returns a `TaskResult` per §4) — these lack the `mockProcessTask` capture
  shape and are easy to miss.
- Expected delay objects use `delaySeconds`, not `delay`.
- Pass-through loaders (§6): assert the task returns the
  `loadItemTypes`/`streamAttachments` mock's value.
- Source that now does `new Mappers({ event })` (§10) needs a `Mappers` mock in the
  factory; source that moved to `import axios from 'axios'` (§9) needs
  `jest.mock('axios')` (plus `jest.mock('axios-retry')` if you built a retry
  client) instead of mocking the SDK's axios.
- Unwrap mapper test doubles (§10). Hand-constructed adapters in integration tests
  follow §5.

---

## Migration checklist

1. `npm uninstall @devrev/ts-adaas && npm install @devrev/airsync-sdk@beta`; replace the import specifier everywhere — imports, `jest.mock`/`jest.requireActual`, `moduleNameMapper` (§1).
2. Rename `AirdropEvent` → `AirSyncEvent`, `AirdropMessage` → `AirSyncMessage`. Drop any `CustomAirdropEvent` cast that only added `user_id`/`dev_oid`/`source_id`/`service_account_id` (§2).
3. Split workers: extraction files use `processExtractionTask`, loading files use `processLoadingTask` (§3). Rewrite `ProcessTaskInterface<State>`/`TaskAdapterInterface<State>` annotations to take the adapter type (§3–4).
4. Convert **every** `adapter.emit(...)` into a returned `TaskResult`; bubble outcomes up from helpers and class methods; `delay` → `delaySeconds` (§4).
5. Replace `WorkerAdapter<T>` annotations with `ExtractionAdapter<T>` / `LoadingAdapter<T>`, and `new WorkerAdapter(...)`/`new State(...)`/`createAdapterState(...)` constructions per §5. Move any `mappers`/`reports`/`processedFiles` access into the loading path.
6. Pass the `TaskResult` straight through from `loadItemTypes` / `loadAttachments` / `streamAttachments`; a connector that augmented `reports` pushes onto `adapter.reports` before returning (§6).
7. ESU workers: push external sync units to the `EXTERNAL_SYNC_UNITS` repo; remove any `external_sync_units` (and `progress`) from emit data — those fields are gone from `EventData` (§7, §12).
8. Remove SDK-owned fields from your `State` interface and `getInitialState`; apply the cursor decision rule for `lastSyncStarted`/`lastSuccessfulSyncStarted` — rename a connector-declared cursor, repoint an SDK-supplied read to `event_context.extract_from` (§8).
9. Replace `axios` / `axiosClient` / `formatAxiosError` SDK imports with your own axios client + `serializeError`; apply the conditional `serializeAxiosError` rule (§9).
10. Drop `.data` from `adapter.mappers.*` result reads — source, hand-rolled types, and test doubles together (§10).
11. Remove usage of deleted legacy modules and event-type-translation helpers (§11, §12).
12. Replace deleted enum members with their modern names; drop any use of the removed deprecated types (`ExtractionMode`, `EventContextIn`/`Out`, `DomainObjectState`, `ErrorLevel`, `LogRecord`, `AdapterUpdateParams`, `AdapterState` — replace an `AdapterState<S>` annotation with your own State type, don't just delete it) (§12).
13. Replace deep `dist/**` imports with root imports; drop the now-internal `ToDevRev` import (§13).
14. Drop each `onTimeout` that only emitted the phase-appropriate event — the SDK default covers it (progress for resumable phases, a timeout error for ESU / metadata / state-deletion). Keep one only when its v1 body did real work (cleanup, a custom error message), preserving the body (§4).
15. Replace `spawn({ workerPath })` with `spawn({ baseWorkerPath: __dirname })`; delete any dead worker-path dispatcher (§15).
16. Migrate jest mocks and assertions — emit-called assertions become return-value assertions (§16).

## A note on the early betas

The betas `2.0.0-beta.0` through `2.0.0-beta.3` still re-exported `axios` /
`axiosClient`; they were removed in `2.0.0-beta.4` (and stay removed in GA — see §9).
If you migrated a connector against any beta before `beta.4` and imported either
symbol from `@devrev/airsync-sdk`, it will fail to compile once you move to
`beta.4`/GA — apply §9.
