# Migrating connectors from v1 (`@devrev/ts-adaas`) to v2 (`@devrev/airsync-sdk`)

This guide covers every breaking change between `@devrev/ts-adaas` v1.x and
`@devrev/airsync-sdk` v2.0.0, with before/after examples taken from real
connectors. The wire protocol (event payloads sent to the platform, API routes,
artifact/upload flow) is **unchanged** — only the connector-facing API changed.

## TL;DR — what breaks

| # | Change | Impact |
|---|--------|--------|
| 1 | Package renamed `@devrev/ts-adaas` → `@devrev/airsync-sdk` | every import |
| 2 | `AirdropEvent` → `AirSyncEvent`, `AirdropMessage` → `AirSyncMessage` | type annotations |
| 3 | Deprecated event-type enum members deleted | only if you used old `Extraction*` members |
| 4 | `processTask` → `processExtractionTask` / `processLoadingTask` | every worker file |
| 5 | `adapter.emit(...)` removed — tasks **return** a `TaskResult` instead | every worker file |
| 6 | External sync units must be pushed to a repo (no more `external_sync_units` in emit data) | ESU workers |
| 7 | `adapter.state` is connector-state only; SDK fields moved to `adapter.sdkState` | only if you read/wrote SDK fields |
| 8 | `WorkerAdapter` class/type removed → `ExtractionAdapter` / `LoadingAdapter` | helper-function signatures |
| 9 | `loadItemTypes` / `loadAttachments` / `streamAttachments` return a `TaskResult` | loading + attachment workers |
| 10 | Deprecated v1 modules deleted (`Adapter`, `createAdapter`, `DemoExtractor`, `HTTPClient`, `defaultResponse`, legacy `Uploader`) | only legacy code |
| 11 | Legacy `string[]` form of the processed-attachments dedup list is no longer migrated | in-flight attachment syncs started on SDK < 1.15.2 |

What does **not** change: `spawn(...)` and all its options (`baseWorkerPath`,
`initialState`, `initialDomainMapping`, `options.batchSize`, `timeout`,
`isLocalDevelopment`, `workerPathOverrides`), default worker paths
(`/workers/data-extraction` etc.), repos (`initializeRepos`, `getRepo`,
`push`), normalization interfaces (`NormalizedItem`, `NormalizedAttachment`,
`RepoInterface`, `ExternalSyncUnit`), the uploader, mappers, logger,
`installInitialDomainMapping`, the `axios`/`axiosClient` re-exports,
`formatAxiosError`/`serializeAxiosError`, `createMockEvent`/`MockServer`,
HTTP retry behavior, and all event-type **string values** on the wire.

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

> **Deep imports** like `import { Item } from '@devrev/ts-adaas/dist/repo/repo.interfaces'`
> are fragile and should be replaced with root imports where the symbol is
> exported. If a symbol you need is not exported from the root, request it
> rather than deep-importing.

## 2. Type renames

Hard rename, no compatibility alias:

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

Payload shape is identical — only the type name changed. Platform-owned strings
(`/internal/airdrop.*` routes, `'ADaaS'` external system type,
`adaas_library_version` metadata key, `airdrop_*` mapping enum values) are
intentionally unchanged.

> `AirSyncEvent.context` now declares the identity fields the platform actually
> sends — `user_id`, `dev_oid`, `source_id`, `service_account_id` — alongside the
> existing `secrets`, `snap_in_id`, and `snap_in_version_id`. If you previously
> cast the event to a hand-rolled `CustomAirdropEvent` to read `context.user_id`,
> you can drop that cast and read the fields off `adapter.event.context` directly.

## 3. Deleted deprecated enum members

The old/new duplicate enum members were collapsed; only the new names remain.
The **string values of the kept members are byte-identical to v1**, so nothing
changes on the wire — only the TypeScript member names.

> The **deleted** members carried *different, older* string values
> (e.g. v1 `ExtractionDataStart = 'EXTRACTION_DATA_START'` vs the kept
> `StartExtractingData = 'START_EXTRACTING_DATA'`). The platform stopped sending
> those old strings, and v2 no longer translates them (see the note at the end
> of this section), so the deletion is safe — but don't assume a deleted member
> and its replacement shared a value; they did not.

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

**`ExtractorEventType` (outgoing):** all `Extraction*` members
(`ExtractionDataDone`, `ExtractionDataDelay`, `ExtractionAttachmentsProgress`, …)
are deleted; use the `*Extraction*` members (`DataExtractionDone`,
`DataExtractionDelayed`, `AttachmentExtractionProgress`, …). In practice you
will rarely reference `ExtractorEventType` at all in v2 — see §5.

**`LoaderEventType`:** the typo/duplicate members `DataLoadingDelay` and
`AttachmentsLoadingProgress/Delayed/Done/Error` are deleted; use
`DataLoadingDelayed` and `AttachmentLoading*`.

Also note: the SDK no longer translates old event-type strings coming from the
platform — the platform sends only the new strings, and the SDK passes
`event.payload.event_type` through untouched.

## 4 + 5. The new worker contract: return a `TaskResult` instead of emitting

This is the core change of v2. In v1 the connector decided *which event* to
emit and called `adapter.emit(...)`. In v2 the connector only reports *how the
phase ended* by **returning** a `TaskResult`; the SDK maps it to the correct
platform event for the current phase and emits it exactly once:

```ts
export type TaskResult =
  | { status: 'success' }
  | { status: 'progress' }
  | { status: 'delay'; delaySeconds: number }
  | { status: 'error'; error: ErrorRecord };
```

Status → emitted event, per phase:

| status | resumable phases (data/attachment extraction & loading) | non-resumable (ESU, metadata, state deletion) |
|--------|----------------------------------------------------------|-----------------------------------------------|
| `'success'` | `*Done` | `*Done` |
| `'progress'` | `*Progress` | `*Error` (illegal status; descriptive message) |
| `'delay'` | `*Delayed` (with `delay` seconds) | `*Error` (illegal status) |
| `'error'` | `*Error` (with the error record) | `*Error` |

`processTask` is split into two typed entry points, and `onTimeout` is now
**optional** (defaults to a `progress` result — see the note below for
non-resumable phases):

```ts
// v1
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

```ts
// v2
import { processExtractionTask } from '@devrev/airsync-sdk';

processExtractionTask({
  task: async ({ adapter }) => {
    // ... extract ...
    return { status: 'success' };
  },
  // onTimeout can be omitted entirely: the SDK emits progress by default.
});
```

Loading workers use `processLoadingTask` the same way.

### Emit-call → return-value translation table

| v1 | v2 |
|----|----|
| `await adapter.emit(XxxDone)` | `return { status: 'success' }` |
| `await adapter.emit(XxxProgress, { progress: n })` | `return { status: 'progress' }` (the `progress` % was already deprecated/ignored) |
| `await adapter.emit(XxxDelayed, { delay: seconds })` | `return { status: 'delay', delaySeconds: seconds }` |
| `await adapter.emit(XxxError, { error: { message } })` | `return { status: 'error', error: { message } }` |
| `await adapter.emit(ExternalSyncUnitExtractionDone, { external_sync_units })` | push to repo + `return { status: 'success' }` — see §6 |

Everything the SDK attached automatically in v1 is still attached
automatically: artifacts of uploaded repos (extraction events), `reports` and
`processed_files` (loading events), and state is still saved before every
non-stateless emit. An explicit `await adapter.postState()` before returning is
no longer needed for the emit path (it still works and is harmless).

### Emits buried in helper functions

A common v1 pattern is emitting deep inside helpers and signalling the caller
to stop:

```ts
// v1 — helper emits, returns false to abort
async function extractList(adapter: WorkerAdapter<State>, ...) {
  if (rateLimited) {
    await adapter.emit(ExtractorEventType.DataExtractionDelayed, { delay });
    return false;
  }
  ...
}
```

In v2 the helper must **bubble the outcome up** instead, because only the
task's return value reaches the SDK:

```ts
// v2 — helper returns the outcome; task returns it to the SDK
async function extractList(adapter: ExtractionAdapter<State>, ...): Promise<TaskResult | null> {
  if (rateLimited) return { status: 'delay', delaySeconds: delay };
  ...
  return null; // keep going
}

processExtractionTask({
  task: async ({ adapter }) => {
    for (const itemType of itemTypes) {
      const stop = await extractList(adapter, itemType);
      if (stop) return stop;
    }
    return { status: 'success' };
  },
});
```

### Timeout handling inside the task

Checking `adapter.isTimeout` in your extraction loop still works exactly like
v1 — but instead of emitting progress and exiting, return progress:

```ts
// v2
if (adapter.isTimeout) {
  return { status: 'progress' }; // platform will send CONTINUE_* next
}
```

> **Behavior note — the timeout outcome always wins.** Once the soft timeout has
> fired, the SDK emits the `onTimeout` result (or the default `progress`) and
> **ignores whatever the task returned**, by design: a phase that ran out of time
> must hand off for continuation rather than report itself complete. So if you
> have cleanup or a specific outcome that must survive a timeout, put it in
> `onTimeout`, not in the task's return value.

> **Non-resumable phases (ESU, metadata, state deletion):** the default
> `onTimeout` produces a `progress` result, which is illegal for these phases
> and is emitted as an error with a generic message. If you want a clean error
> message on timeout for these workers, provide an explicit `onTimeout`:
> `onTimeout: async () => ({ status: 'error', error: { message: 'Lambda timeout.' } })`.

## 6. External sync units go through a repo

In v1 the SDK accepted `external_sync_units` in the emit data and internally
uploaded them via a repo. With emit gone, push them to the
`EXTERNAL_SYNC_UNITS` repo yourself:

```ts
// v1
await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone, {
  external_sync_units: externalSyncUnits,
});
```

```ts
// v2
import { AirSyncDefaultItemTypes, processExtractionTask } from '@devrev/airsync-sdk';

processExtractionTask({
  task: async ({ adapter }) => {
    const externalSyncUnits = await fetchExternalSyncUnits();

    adapter.initializeRepos([
      {
        itemType: AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS,
        // match the batching the v1 SDK used internally for ESUs
        overridenOptions: { batchSize: 25000, skipConfirmation: true },
      },
    ]);
    await adapter
      .getRepo(AirSyncDefaultItemTypes.EXTERNAL_SYNC_UNITS)
      ?.push(externalSyncUnits);

    return { status: 'success' };
  },
});
```

The repo is uploaded automatically before the `Done` event is emitted (same as
all repos).

## 7. State split: `adapter.state` vs `adapter.sdkState`

In v1, connector state and SDK bookkeeping lived in one flat object, persisted
as one blob, and `adapter.state` exposed both. In v2:

- `adapter.state` is **connector state only** — exactly the shape of the
  `initialState` you pass to `spawn`. Reads and writes work as before.
- SDK bookkeeping (`lastSyncStarted`, `lastSuccessfulSyncStarted`,
  `workersOldest/Newest`, `pendingWorkers*`, `toDevRev`, `fromDevRev`,
  `snapInVersionId`) moved to `adapter.sdkState`. It is SDK-internal; do not
  write to it. If you were *reading* one of these fields (e.g.
  `adapter.state.lastSuccessfulSyncStarted` for incremental sync), prefer
  `event.payload.event_context.extract_from` / `extract_to`, which the SDK now
  resolves for you.
- On disk, state is persisted as `{ connectorState, sdkState }`. The SDK
  **migrates v1 flat blobs automatically on first read** (known SDK keys are
  split out; everything else becomes connector state), so in-flight syncs
  survive the upgrade. The migration is **not** version-gated — any flat blob is
  split, regardless of which SDK version wrote it. (The one thing that is *not*
  back-migrated is the legacy `string[]` form of the attachment dedup list — see
  §9.)
- Edge case: if your v1 connector state had a top-level key literally named
  `connectorState` or `sdkState`, the migration will misread it — rename it
  before upgrading.

```ts
// v1 — SDK fields visible on state (don't carry this over)
if (adapter.state.lastSuccessfulSyncStarted) { ... }

// v2 — use the resolved extraction window instead
const { extract_from, extract_to } = adapter.event.payload.event_context;
```

Pure connector-state usage is unaffected:

```ts
// works identically in v1 and v2
adapter.state[itemType].cursor = nextCursor;
adapter.state[itemType].complete = true;
```

## 8. `WorkerAdapter` → `ExtractionAdapter` / `LoadingAdapter`

The `WorkerAdapter` class no longer exists. Helper signatures change to the
mode-specific adapter:

```ts
// v1
async function extractList(adapter: WorkerAdapter<ExtractorState>, ...) { ... }
// v2
import { ExtractionAdapter } from '@devrev/airsync-sdk';
async function extractList(adapter: ExtractionAdapter<ExtractorState>, ...) { ... }
```

Extraction surface (`initializeRepos`, `getRepo`, `artifacts`,
`streamAttachments`, `processAttachment`, `shouldExtract`) lives on
`ExtractionAdapter`; loading surface (`loadItemTypes`, `loadAttachments`,
`loadItem`, `loadAttachment`, `mappers`, `reports`, `processedFiles`) lives on
`LoadingAdapter`. Shared: `event`, `state`, `sdkState`, `extractionScope`,
`postState`, `isTimeout`.

> Only the `WorkerAdapter` **class** was removed. The **types**
> `WorkerAdapterInterface` and `WorkerAdapterOptions` still exist and are still
> exported, unchanged. Don't do a blind global rename of every `WorkerAdapter`
> token — replace the class/`WorkerAdapter<T>` annotations only.

> Symbols that previously required a deep `dist/` import are now on the root
> barrel: `Mappers` (class), `ItemTypeToLoad`, and `Item` all import from
> `@devrev/airsync-sdk` directly. `ToDevRev` is **not** exported — it is
> SDK-internal now (drop any use of it; see §7).

## 9. SDK loading/streaming methods return a `TaskResult`

`loadItemTypes`, `loadAttachments` and `streamAttachments` no longer emit or
exit mid-flight — they return a `TaskResult` you simply pass through:

```ts
// v1
processTask({
  task: async ({ adapter }) => {
    const { reports, processed_files } = await adapter.loadItemTypes({ itemTypesToLoad });
    await adapter.emit(LoaderEventType.DataLoadingDone, { reports, processed_files });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.DataLoadingProgress, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
});
```

```ts
// v2
processLoadingTask({
  task: async ({ adapter }) => {
    return adapter.loadItemTypes({ itemTypesToLoad });
  },
});
```

Rate limits (→ `delay`), timeouts (→ `progress`), errors (→ `error`) and
completion (→ `success`) are all encoded in the returned result; `reports` and
`processed_files` are attached to the emitted event automatically.

Attachment extraction:

```ts
// v1
const response = await adapter.streamAttachments({ stream: getFileStream, batchSize: 50 });
if (response?.delay) {
  await adapter.emit(ExtractorEventType.AttachmentExtractionDelayed, { delay: response.delay });
} else if (response?.error) {
  await adapter.emit(ExtractorEventType.AttachmentExtractionError, { error: response.error });
} else {
  await adapter.emit(ExtractorEventType.AttachmentExtractionDone);
}
```

```ts
// v2
return adapter.streamAttachments({ stream: getFileStream, batchSize: 50 });
```

Custom attachment `processors` (reducer/iterator) are still supported with the
same signatures.

> **Edge regression — very old in-flight attachment syncs.** In v1 the SDK
> migrated the legacy `string[]` form of the processed-attachments dedup list
> (`sdkState.toDevRev.attachmentsMetadata.lastProcessedAttachmentsIdsList`) to the
> current `{ id, parent_id }[]` form on read. v2 removed that conversion. The
> `string[]` form only exists in state written by SDK **< 1.15.2**. If an
> attachment-extraction phase started on a pre-1.15.2 SDK and is *still mid-flight*
> when the connector upgrades to v2, the v2 dedup check (`it.id === …`) silently
> fails to match the bare-string entries, so attachments already downloaded in
> that sync get re-uploaded once. New syncs (and any sync started on ≥ 1.15.2) are
> unaffected. The duplicates are deduplicated downstream by the platform, so the
> only cost is wasted re-download/upload work on that one continuation.

## 10. Deleted legacy modules

Everything under the v1 `deprecated/` tree is gone: `Adapter`,
`createAdapter`, `DemoExtractor`, `HTTPClient`, `defaultResponse`, and the
legacy `Uploader` export. Replacements: the v2 adapters + `process*Task` for
`Adapter`/`createAdapter`; `axiosClient` for `HTTPClient`; repos for the legacy
uploader. (`formatAxiosError` is still exported.)

## 11. Migration checklist

1. `npm uninstall @devrev/ts-adaas && npm install @devrev/airsync-sdk`; replace import specifiers.
2. Rename `AirdropEvent` → `AirSyncEvent`, `AirdropMessage` → `AirSyncMessage`.
3. Replace deleted enum members with their new names (§3) — values unchanged.
4. Split workers: extraction files use `processExtractionTask`, loading files use `processLoadingTask`.
5. Convert every `adapter.emit(...)` into a returned `TaskResult` (§4–5); bubble outcomes up from helpers.
6. ESU workers: push external sync units to the `EXTERNAL_SYNC_UNITS` repo (§6).
7. Replace `WorkerAdapter<T>` annotations with `ExtractionAdapter<T>` / `LoadingAdapter<T>`.
8. Remove reads/writes of SDK-owned state fields from `adapter.state`; use the event context's `extract_from`/`extract_to` (§7).
9. Pass through the `TaskResult` from `loadItemTypes`/`loadAttachments`/`streamAttachments` (§9).
10. Decide per worker whether you need an explicit `onTimeout` (recommended for ESU/metadata to control the error message; usually omit elsewhere).
11. Remove deep `dist/**` imports and any usage of deleted legacy modules.
12. Update jest mocks of the SDK module (they hardcode the v1 shape: `processTask`, `WorkerAdapter`, old enum members).
