# Migrating connectors from v1 (`@devrev/ts-adaas`) to v2 (`@devrev/airsync-sdk`)

This guide covers every connector-facing breaking change between
`@devrev/ts-adaas` v1.x and `@devrev/airsync-sdk` v2.0.0, with before/after
examples drawn from real connectors.

**The wire protocol is unchanged.** Event payloads sent to the platform, API
routes, headers, the artifact/upload flow, and every surviving event-type
**string value** are byte-for-byte identical to v1. Only the connector-facing
**TypeScript API** changed. A correctly migrated connector talks to the
platform exactly like a v1 connector did.

> **Why a hard break with no deprecation shims?** v2 is a single bundled-pain
> major release: the package was renamed, so there are no existing
> `@devrev/airsync-sdk` consumers to keep backward-compatible. Everything that
> needed to change changed at once, in one guide, rather than across a long
> deprecation cycle.

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
| 12 | Deprecated event-type enum **members** deleted; deprecated types/enums (`ExtractionMode`, `EventContextIn`/`Out`, `DomainObjectState`, `ErrorLevel`, `LogRecord`, `AdapterUpdateParams`, `AdapterState`) **removed** | only if you used the old members/types |
| 13 | Several deep `dist/**` import paths moved/removed | deep-importers |
| 14 | Legacy `string[]` attachment-dedup migration dropped | in-flight attachment syncs started on SDK **< 1.15.2** |
| 15 | `spawn`'s deprecated `workerPath` option **removed** — use `baseWorkerPath: __dirname` | connectors still passing `workerPath` |
| 16 | `EventData.progress` field removed (no-op since v1; backend computes progress) | connectors that set `progress` in emit data |

What does **not** change: `spawn(...)` and its surviving options (`initialState`,
`initialDomainMapping`, `workerPathOverrides`, `baseWorkerPath`,
`options.batchSize`, `timeout`, `isLocalDevelopment`, …) — the one exception is
the long-deprecated `workerPath`, which is removed (§15); default worker paths
(`/workers/data-extraction`, etc.); repos (`initializeRepos`, `getRepo`,
`push`); the normalization
interfaces (`NormalizedItem`, `NormalizedAttachment`, `RepoInterface`,
`ExternalSyncUnit`); `installInitialDomainMapping`; `createMockEvent` /
`MockServer`; HTTP retry behavior; `event_context.extract_from` /
`extract_to`; and every surviving event-type string value on the wire.

---

## 1. Package rename

```bash
npm uninstall @devrev/ts-adaas
npm install @devrev/airsync-sdk
```

Then global-replace the import specifier:

```ts
// v1
import { spawn, EventType } from '@devrev/ts-adaas';
// v2
import { spawn, EventType } from '@devrev/airsync-sdk';
```

> **Deep imports** like `@devrev/ts-adaas/dist/...` are fragile — several of
> these paths moved or were removed in v2 (see §13). Prefer root imports; the
> v2 barrel now exports several symbols that previously required a deep import
> (`Mappers`, `Item`, `ItemTypeToLoad`).

## 2. Type renames: `AirdropEvent` → `AirSyncEvent`

Hard rename, no compatibility alias. The payload **shape** is identical — only
the type name changed.

| v1 | v2 |
|----|----|
| `AirdropEvent` | `AirSyncEvent` |
| `AirdropMessage` | `AirSyncMessage` |

```ts
// v1
const run = async (events: AirdropEvent[]) => { ... };
// v2
const run = async (events: AirSyncEvent[]) => { ... };
```

No other public type was renamed — `ConnectionData`, `EventContext`,
`EventData`, `ExtractorEvent`, and `ExternalSyncUnit` keep their v1 names.
Platform-owned strings (`/internal/airdrop.*` routes, the `'ADaaS'` external
system type, the `adaas_library_version` metadata key, `airdrop_*` mapping enum
values) are intentionally unchanged.

### `AirSyncEvent.context` gained identity fields

`AirSyncEvent.context` now declares the identity fields the platform already
sends, in addition to the existing `secrets`, `snap_in_id`, and
`snap_in_version_id`:

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
`CustomAirdropEvent` that added `user_id`), you can drop the extension and read
`adapter.event.context.user_id` directly. (`snap_in_id` was already present in
v1; only the four fields above are new.)

> Note: these four fields live on the **top-level** `AirSyncEvent.context`, not
> on the `EventContext` inside `payload.event_context`. The latter is a
> different object and is unchanged.

## 3 + 4. The new worker contract: **return a `TaskResult`** instead of emitting

This is the core change of v2. In v1 the connector decided *which event* to
emit and called `adapter.emit(...)`. In v2 the connector only reports *how the
phase ended* by **returning** a `TaskResult`; the SDK maps it to the correct
platform event for the current phase and emits it exactly once.

```ts
// the exact union (exported from @devrev/airsync-sdk)
export type TaskResult =
  | { status: 'success' }
  | { status: 'progress' }
  | { status: 'delay'; delaySeconds: number }   // note: delaySeconds, not delay
  | { status: 'error'; error: ErrorRecord };    // ErrorRecord = { message: string }
```

`processTask` is split into two typed entry points — pick the one matching the
worker's phase:

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
> `this.adapter.emit(...)` is a hard **compile error** in v2, not a
> deprecation. Every emit site must be converted.

### `emit()` → `return` translation table

| v1 emit call | v2 return |
|--------------|-----------|
| `await adapter.emit(XxxDone)` | `return { status: 'success' }` |
| `await adapter.emit(XxxProgress, { progress })` | `return { status: 'progress' }` |
| `await adapter.emit(XxxDelayed, { delay })` | `return { status: 'delay', delaySeconds: delay }` |
| `await adapter.emit(XxxError, { error })` | `return { status: 'error', error }` |
| `await adapter.emit(ExternalSyncUnitExtractionDone, { external_sync_units })` | push to repo + `return { status: 'success' }` — see §7 |

`progress` (`{ progress: n }`) carried no semantic value in v1 beyond "not done
yet" and is dropped; the platform tracks progress itself.

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

A common v1 pattern is emitting deep inside a helper and returning a boolean to
tell the caller to stop. Since only the **task's return value** reaches the SDK
in v2, the helper must **bubble the outcome up** instead.

A clean way (used by the migrated google-drive connector) is to store the
terminal result on a field and return it once the loop unwinds:

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

For a simple "stop iterating" signal, return the `TaskResult` directly up the
call chain:

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
// v2
if (adapter.isTimeout) {
  return { status: 'progress' }; // platform sends CONTINUE_* next
}
```

Two important behaviors:

- **The timeout outcome always wins.** Once the soft timeout has fired, the SDK
  emits the `onTimeout` result (or the default `progress`) and **ignores
  whatever the task returned**, by design: a phase that ran out of time must
  hand off for continuation, not report itself complete. Put any cleanup that
  must survive a timeout in `onTimeout`, not in the task body.
- **`onTimeout` is optional**, but its default is `{ status: 'progress' }`.
  That is correct for resumable phases. For **non-resumable** phases (external
  sync units, metadata, state deletion), `progress` is illegal and is emitted
  as an **error** — so provide an explicit `onTimeout` there to control the
  message:

  ```ts
  onTimeout: async () => ({
    status: 'error',
    error: { message: 'Failed to extract metadata. Lambda timeout.' },
  }),
  ```

> Do **not** call `process.exit()` yourself in v2. v1 helpers sometimes called
> `process.exit(0/1)` after emitting; the v2 SDK owns the single worker exit
> after it emits your `TaskResult`.

## 5. `WorkerAdapter` → `ExtractionAdapter` / `LoadingAdapter`

The `WorkerAdapter` **class** is gone. Replace the type annotation on your
helpers with the mode-specific adapter:

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
> `WorkerAdapterOptions` still exist and are still exported — don't blindly
> rename every `WorkerAdapter` token; replace the `WorkerAdapter<T>`
> annotations only.

> **`mappers` / `reports` / `processedFiles` moved to `LoadingAdapter` only.**
> In v1 they were on the single `WorkerAdapter` and technically reachable in any
> phase. In v2 they are not on `ExtractionAdapter`. Code that touched
> `adapter.mappers` (etc.) during an extraction phase must move to the loading
> path.

## 6. Loading & attachment methods return a `TaskResult`

`loadItemTypes`, `loadAttachments`, and `streamAttachments` no longer emit or
exit mid-flight — they **return** a `TaskResult` you pass straight through.
Rate limits (→ `delay`), timeouts (→ `progress`), errors (→ `error`), and
completion (→ `success`) are all encoded in the result; `reports` /
`processed_files` (loading) and artifacts (extraction) are attached to the
emitted event automatically.

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

Custom attachment processors (reducer/iterator) are still supported with the
same call signatures; only their `adapter` parameter type changes from
`WorkerAdapter<C>` to `ExtractionAdapter<C>` (§5). The `getAttachmentStream`
function you implement still returns `{ httpStream }` / `{ delay }` /
`{ error }` — but see §9 for the `httpStream` type change.

## 7. External sync units go through a repo

In v1 the SDK accepted `external_sync_units` in the emit data and uploaded them
internally. With emit gone, push them to the `EXTERNAL_SYNC_UNITS` repo
yourself. The `EventData.external_sync_units` field — deprecated in v1 — has
been **removed entirely** in v2: there is no inline ESU path at all, and any
code still referencing `external_sync_units` in emit data is now a compile
error. External sync units leave the worker only as repo artifacts.

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

> If your connector already pushed ESUs to a repo in v1 (some do), this section
> is a no-op for you — just convert the trailing emit to `return`.

## 8. State split: `adapter.state` vs `adapter.sdkState`

In v1, connector state and SDK bookkeeping lived in one flat object, persisted
as one blob, and `adapter.state` exposed both. In v2:

- **`adapter.state` is connector state only** — exactly the shape of the
  `initialState` you pass to `spawn`. The getter and setter both survive, so
  in-place reads/writes work unchanged:

  ```ts
  // works identically in v1 and v2
  adapter.state[itemType].cursor = nextCursor;
  adapter.state[itemType].complete = true;
  ```

- **SDK bookkeeping** (`workersOldest`/`workersNewest`, `pendingWorkers*`,
  `toDevRev`, `fromDevRev`, `snapInVersionId`) moved to **`adapter.sdkState`**
  (read-only getter).
- On disk, state is persisted as a `{ connectorState, sdkState }` envelope. The
  SDK **migrates a v1 flat blob automatically on first read** (recognized SDK
  keys split into `sdkState`, the rest into `connectorState`), so in-flight
  syncs survive the upgrade.

> **`lastSyncStarted` / `lastSuccessfulSyncStarted` are gone.** Both fields were
> `@deprecated` in v1 and are **removed from `SdkState` in v2** — they are no
> longer set, persisted, or readable via `adapter.sdkState`. They were
> wall-clock sync-start timestamps; the SDK now resolves the incremental window
> from the extraction-data boundaries instead (`workersOldest`/`workersNewest`
> and the resolved `extract_from`/`extract_to`). The two old key names are still
> recognized by the v1-blob migration, so they are cleanly dropped from any old
> state rather than leaking into your connector state.

### If your v1 connector mixed SDK fields into its own `State` interface

Some connectors declared SDK-owned fields (e.g. `toDevRev`,
`lastSuccessfulSyncStarted`) on their hand-written `State` type and seeded them
in `getInitialState()`. Remove those from your interface and initial state —
`toDevRev`/`fromDevRev`/`workers*` are SDK-managed now, and
`lastSyncStarted`/`lastSuccessfulSyncStarted` no longer exist at all:

```ts
// v1 — State interface mixing SDK fields (remove these)
export interface State {
  // ... your fields ...
  lastSyncStarted?: string;          // removed in v2 — no replacement field
  lastSuccessfulSyncStarted?: string; // removed in v2 — read workersNewest / extract_to instead
  toDevRev?: ToDevRev;          // also drop the dist/state/state.interfaces import
}
```

### Reading the incremental-sync window

In v1 you read `lastSuccessfulSyncStarted` to decide an incremental cursor. That
field is gone (above). Read the window the SDK resolves for you instead:

```ts
// preferred — the resolved window for this invocation, on the event context
const { extract_from, extract_to } = adapter.event.payload.event_context;

// the persisted cross-sync high-water mark (committed at end of each cycle)
const lastExtractedTo = adapter.sdkState.workersNewest;
```

`extract_from`/`extract_to` are the per-invocation window the SDK computes from
the platform's `extraction_start_time`/`extraction_end_time`;
`workersOldest`/`workersNewest` are the persisted boundaries the SDK commits at
the end of a completed cycle and the true replacement for the old
"last successful sync" resume point.

> **`AdapterState<ConnectorState>` is removed.** The deprecated flat
> `ConnectorState & SdkState` alias no longer exists. If you annotated anything
> `AdapterState<S>`, drop the import — use your own connector `State` type for
> `adapter.state`, and read SDK fields from `adapter.sdkState` (or the event
> context). The v2 on-disk shape is the `AdapterStateEnvelope`
> (`{ connectorState, sdkState }`), which the SDK manages for you.

> **Edge regression (old in-flight incremental syncs):** the SDK used to fall
> back to `lastSuccessfulSyncStarted` when resolving a `WORKERS_NEWEST` window
> on state that predated `workersNewest` (SDK **< 1.17.1**). With the field
> removed, that fallback is gone: such a window now resolves to the unbounded
> epoch, so an incremental sync still mid-flight across the upgrade re-extracts
> from the beginning **once**. The next completed cycle commits `workersNewest`
> and the sync self-heals; the platform deduplicates downstream. New syncs and
> any sync whose first full cycle completed on ≥ 1.17.1 are unaffected. Drain
> in-flight incremental syncs before upgrading if the one-time re-extract
> matters for your deployment.

> **Edge case:** if your v1 connector state had a top-level key literally named
> `connectorState` or `sdkState`, the auto-migration mis-reads it (the envelope
> is detected by those key names). Rename such a key **before** upgrading.

## 9. HTTP / axios surface removed from the SDK

> This is the area the previously-published guide got **wrong** — it claimed
> the axios surface was "still exported." It is not. This was verified by
> typechecking a real connector against the v2 build.

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

> If you previously deep-imported `@devrev/ts-adaas/dist/http/axios-client`,
> that path **no longer exists** (the file was renamed to `http/client` and is
> internal). Bring your own axios instance as above.

For error logging, replace `formatAxiosError` / `serializeAxiosError` with the
exported `serializeError`:

```ts
import { serializeError } from '@devrev/airsync-sdk';
console.error(serializeError(error));
```

### `httpStream` type changed

The connector-implemented attachment-stream function returns
`ExternalSystemAttachmentStreamingResponse`, whose `httpStream` field changed
from axios's `AxiosResponse` to the new public `HttpStreamResponse`
(`{ data: any; headers: Record<string, any> }`). An axios stream response still
satisfies it structurally, but if you annotated the stream with `AxiosResponse`
imported *from the SDK*, switch the annotation to `HttpStreamResponse` (or
import `AxiosResponse` from `axios` directly).

## 10. `Mappers` methods return the unwrapped body

`Mappers.getByTargetId` / `getByExternalId` / `create` / `update` changed their
return type from `Promise<AxiosResponse<T>>` to `Promise<T>` — they now return
the response **body** directly. Drop the `.data` access:

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

This is a **silent** change for code that reads `.data` (it will fail to
type-check, or read `undefined` if loosely typed). The `Mappers` class is also
now exported from the package root, so you no longer need to deep-import it from
`dist/mappers/mappers`.

## 11. Deleted legacy modules

Everything under the v1 `deprecated/` tree is gone:

| Removed | Replacement |
|---------|-------------|
| `Adapter`, `createAdapter` | `ExtractionAdapter` / `LoadingAdapter` + `processExtractionTask` / `processLoadingTask` |
| `DemoExtractor` | — (reference implementation only) |
| `HTTPClient`, `defaultResponse` | your own axios client (§9) |
| deprecated `Uploader` | repos (`initializeRepos` / `getRepo` / `push`) |

(The SDK has an internal `Uploader` class, but it was never part of the public
API in either version — the *public* v1 `Uploader` was the deprecated one.)

## 12. Deleted deprecated enum members, types & enums

The old/new duplicate enum members were collapsed; only the modern names
remain. **The string values of the surviving members are byte-identical to
v1**, so nothing changes on the wire — only the TypeScript member names.

> ⚠️ The **deleted** `EventType` / `ExtractorEventType` members carried
> *different, older* string values than their replacements (e.g. v1
> `ExtractionDataStart = 'EXTRACTION_DATA_START'` vs the surviving
> `StartExtractingData = 'START_EXTRACTING_DATA'`). The modern members already
> existed in v1 with the modern values, so survivors are wire-compatible — but
> a deleted member and its replacement did **not** share a string value.

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
(`ExtractionDataDone`, `ExtractionDataDelay`, `ExtractionAttachmentsProgress`,
…) are deleted; use the `*Extraction*` members (`DataExtractionDone`,
`DataExtractionDelayed`, `AttachmentExtractionProgress`, …). In practice you'll
rarely reference `ExtractorEventType` at all in v2 — see §4.

**`LoaderEventType`:** the duplicate members `DataLoadingDelay` and
`AttachmentsLoading*` (plural) are deleted; use `DataLoadingDelayed` and
`AttachmentLoading*` (singular). These duplicates shared the same string value
as their survivors, so removing them is a pure source-name change.

> **No more incoming-event-type translation.** v1 shipped an
> `event-type-translation` module that mapped legacy platform strings onto the
> modern enum members (and translated outgoing types). v2 removed it entirely
> and passes `event_context.event_type` through untouched. Any connector
> importing `translateIncomingEventType` / `translateOutgoingEventType` /
> `translateExtractorEventType` / `translateLoaderEventType` from the SDK will
> fail to compile — drop them; the platform sends modern strings.

### Removed duplicate `UnknownEventType` members

`UnknownEventType = 'UNKNOWN_EVENT_TYPE'` was declared on three enums in v1.
The copies on `EventType` and `ExtractorEventType` are **removed**; the
`LoaderEventType.UnknownEventType` member (the one the SDK actually uses as its
"unrecognized event" sentinel) **stays**. If you matched on
`EventType.UnknownEventType` or `ExtractorEventType.UnknownEventType`, switch to
`LoaderEventType.UnknownEventType` or compare against the raw
`'UNKNOWN_EVENT_TYPE'` string (the value is unchanged).

### Removed deprecated types & enums

These were `@deprecated` in v1 and are **deleted from the public API** in v2.
None are referenced by the modern worker contract; each row gives the
replacement (or "no replacement" where the concept is gone):

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

Also removed from `EventData`: the deprecated `external_sync_units` field (§7)
and the deprecated `progress` field (a no-op since v1 — the backend computes
progress). The `artifacts` field on `EventData` is **kept** — it is how the SDK
attaches uploaded repo artifacts (including external sync units) to the emitted
event.

## 13. Deep-import paths that moved or broke

The compiled `dist/` mirrors `src/` 1:1, so a deep import keeps working only if
the underlying source file still lives at the same relative path. Status of the
paths real connectors used:

| Deep import | Status in v2 |
|-------------|--------------|
| `dist/http/axios-client` (`axiosClient`) | ❌ **broken** — file renamed to `http/client` and made internal. Bring your own axios (§9). |
| `dist/state/state.interfaces` (`ToDevRev`) | ⚠️ still resolves, but `ToDevRev` is SDK-internal now (§8) — **drop** the import, don't repoint it |
| `dist/repo/repo.interfaces` (`Item`) | ✅ resolves — but `Item` is now on the root barrel, prefer the root import |
| `dist/types/loading` (`ItemTypeToLoad`) | ✅ resolves — also now on the root barrel |
| `dist/mappers/mappers` (`Mappers`) | ✅ resolves — also now on the root barrel (and note the return-type change, §10) |
| `dist/types/extraction` (`InitialSyncScope`) | ✅ resolves — also on the root barrel |

Also: `mappers/mappers.interface` was renamed to `mappers.interfaces`
(singular → plural), so a deep import of `dist/mappers/mappers.interface`
breaks even though every symbol inside is unchanged.

**Recommended:** replace all deep `dist/**` imports with root imports. If a
symbol you need isn't on the root barrel, request it rather than deep-importing.

## 14. Edge regression: very old in-flight attachment syncs

In v1 the SDK migrated the legacy `string[]` form of the processed-attachments
dedup list (`lastProcessedAttachmentsIdsList`) to the current
`{ id, parent_id }[]` form on read. v2 removed that conversion.

The `string[]` form only exists in state written by SDK **< 1.15.2**. If an
attachment-extraction phase started on a pre-1.15.2 SDK and is **still
mid-flight** when the connector upgrades to v2, the v2 dedup check
(`it.id === …`) won't match the bare-string entries, so attachments already
downloaded in that sync get re-uploaded once. New syncs — and any sync started
on ≥ 1.15.2 — are unaffected. The platform deduplicates downstream, so the only
cost is the wasted re-download/upload on that one continuation.

If this matters for your deployment, drain in-flight attachment syncs before
upgrading.

## 15. `spawn`'s deprecated `workerPath` option removed

`SpawnFactoryInterface.workerPath` was `@deprecated` in v1 and is **removed** in
v2. Point `spawn` at your worker directory with `baseWorkerPath: __dirname`
instead — the SDK resolves the per-event worker file from there
(`workerPathOverrides` still works for custom paths).

### Before (v1)

```ts
spawn({ event, initialState, workerPath: __dirname + '/workers/data-extraction' });
```

### After (v2)

```ts
spawn({ event, initialState, baseWorkerPath: __dirname });
```

---

## Migration checklist

1. `npm uninstall @devrev/ts-adaas && npm install @devrev/airsync-sdk`; replace the import specifier everywhere.
2. Rename `AirdropEvent` → `AirSyncEvent`, `AirdropMessage` → `AirSyncMessage`. Drop any `CustomAirdropEvent` cast that only added `user_id`/`dev_oid`/`source_id`/`service_account_id` (§2).
3. Split workers: extraction files use `processExtractionTask`, loading files use `processLoadingTask` (§3).
4. Convert **every** `adapter.emit(...)` into a returned `TaskResult`; bubble outcomes up from helpers (§4).
5. Replace `WorkerAdapter<T>` annotations with `ExtractionAdapter<T>` / `LoadingAdapter<T>` (§5). Move any `mappers`/`reports`/`processedFiles` access into the loading path.
6. Pass the `TaskResult` straight through from `loadItemTypes` / `loadAttachments` / `streamAttachments` (§6).
7. ESU workers: push external sync units to the `EXTERNAL_SYNC_UNITS` repo; remove any `external_sync_units` (and `progress`) from emit data — those fields are gone from `EventData` (§7, §12).
8. Remove SDK-owned fields from your `State` interface and `getInitialState`; `lastSyncStarted`/`lastSuccessfulSyncStarted` are gone — read incremental cursors from `event_context.extract_from`/`extract_to` or `adapter.sdkState.workersNewest` (§8).
9. Replace `axios` / `axiosClient` / `formatAxiosError` / `serializeAxiosError` SDK imports with your own axios client + `serializeError` (§9).
10. Drop `.data` from `adapter.mappers.*` result reads (§10).
11. Remove usage of deleted legacy modules and event-type-translation helpers (§11, §12).
12. Replace deleted enum members with their modern names — values unchanged; drop any use of the removed deprecated types (`ExtractionMode`, `EventContextIn`/`Out`, `DomainObjectState`, `ErrorLevel`, `LogRecord`, `AdapterUpdateParams`, `AdapterState`) (§12).
13. Replace deep `dist/**` imports with root imports; drop the now-internal `ToDevRev` import (§13).
14. Decide per worker whether to keep an explicit `onTimeout` (recommended for ESU / metadata / state-deletion phases to control the error message; can be omitted for resumable phases) (§4).
15. Replace `spawn({ workerPath })` with `spawn({ baseWorkerPath: __dirname })` (§15).
16. Update jest mocks of the SDK module — they hardcode the v1 shape (`processTask`, `WorkerAdapter`, old enum members, `axiosClient`).

## A note on `2.0.0-beta.0`

An early beta (`2.0.0-beta.0`) still re-exported `axios` / `axiosClient`. The
GA release removed them (§9). If you migrated a connector against the beta and
imported either symbol from `@devrev/airsync-sdk`, it will fail to compile
against GA — apply §9.
