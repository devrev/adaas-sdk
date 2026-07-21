# v2 Symbol Disposition Map

Exact fate of every v1 `@devrev/ts-adaas` symbol in `@devrev/airsync-sdk` 2.0.0. Dispositions: **kept-same** (leave it), **renamed** (token rename), **removed-use:X** (delete, replace with X), **now-root-import** (was a `dist/**` deep import, now on the root barrel), **drop-import** (delete entirely, no replacement).

Wire protocol is unchanged: every surviving enum STRING VALUE is byte-identical v1→v2.

## Module specifier

| v1 | v2 | Action |
|---|---|---|
| `'@devrev/ts-adaas'` | `'@devrev/airsync-sdk'` | Global-replace the specifier string in every source+test import, `jest.mock('...')`, `jest.requireActual('...')`, `moduleNameMapper`, and the `package.json` dep (uninstall ts-adaas, install airsync-sdk 2.0.0). Rewrites deep-import prefixes too. |

## Entry points & adapters

| v1 symbol | Disposition | Action |
|---|---|---|
| `processTask` | removed-use:`processExtractionTask`\|`processLoadingTask` | Split by phase (extraction dir → Extraction, loading dir → Loading). Keep `<State>` generic. Pair with emit→return of the body. |
| `processExtractionTask` | kept-same | v2 root export. Target of the split for extraction workers. |
| `processLoadingTask` | kept-same | v2 root export. Target of the split for loading workers. |
| `spawn` | kept-same | Root export. Only change: deprecated `workerPath` option removed → use `baseWorkerPath: __dirname`. Other options survive. |
| `WorkerAdapter` (class) | removed-use:`ExtractionAdapter`\|`LoadingAdapter` | The class is gone. Replace `WorkerAdapter<T>` annotations by phase. Do NOT rename `WorkerAdapterInterface`/`WorkerAdapterOptions`. |
| `ExtractionAdapter` | kept-same | Root export. Has initializeRepos/getRepo/streamAttachments/shouldExtract/artifacts + event/state/sdkState/postState/isTimeout/extractionScope. NO mappers/reports/processedFiles. |
| `LoadingAdapter` | kept-same | Root export. Has loadItemTypes/loadAttachments/mappers/reports/processedFiles + shared members. |
| `WorkerAdapterInterface` | kept-same | Still exported. Leave as-is (do not confuse with removed class). |
| `WorkerAdapterOptions` | kept-same | Still exported. Leave as-is. |
| `Adapter` / `createAdapter` | removed-use:`ExtractionAdapter`\|`LoadingAdapter` + `processExtractionTask`\|`processLoadingTask` | Legacy deprecated tree deleted. Migrate to the modern worker contract. |
| `DemoExtractor` | removed (no replacement) | Deleted. Remove any reference. |
| `Uploader` (public deprecated) | removed-use:repos | Deleted. Use initializeRepos/getRepo/push. |
| `HTTPClient` / `defaultResponse` | removed-use:own axios client | Deleted. Self-construct an axios client. |

## Emit / task result

| v1 symbol | Disposition | Action |
|---|---|---|
| `adapter.emit` (method) | removed-use:return `TaskResult` | emit() is protected → every `adapter.emit(...)` is a compile error. Convert per the emit→return table; bubble outcomes up from void/boolean helpers and class methods. |
| `TaskResult` | kept-same | Root type. `{status:'success'}` \| `{status:'progress'}` \| `{status:'delay';delaySeconds:number}` \| `{status:'error';error:ErrorRecord}`. Return type of task/onTimeout and of helpers that bubble an outcome. Has NO `reports`/`processed_files`. |
| `TaskStatus` | kept-same | Root type (`TaskResult['status']`). Use only if the connector annotates the discriminant. |
| `ErrorRecord` | kept-same | Root type `{ message: string }`. Types the `error` field of `{status:'error'}`. `message` must be defined. |

## Enums

| v1 symbol | Disposition | Action |
|---|---|---|
| `EventType` | kept-same (members changed) | Root export, surviving values identical. DELETED members → modern names (values DIFFER but connectors already use modern ones): ExtractionExternalSyncUnitsStart→StartExtractingExternalSyncUnits, ExtractionMetadataStart→StartExtractingMetadata, ExtractionDataStart→StartExtractingData, ExtractionDataContinue→ContinueExtractingData, ExtractionDataDelete→StartDeletingExtractorState, ExtractionAttachmentsStart→StartExtractingAttachments, ExtractionAttachmentsContinue→ContinueExtractingAttachments, ExtractionAttachmentsDelete→StartDeletingExtractorAttachmentsState. `EventType.UnknownEventType` → raw `'UNKNOWN_EVENT_TYPE'`. |
| `ExtractorEventType` | kept-same (rarely needed) | Surviving values byte-identical. DELETED: the `Extraction*`-prefixed duplicates → the `*Extraction*` members (same value); `UnknownEventType` → raw `'UNKNOWN_EVENT_TYPE'`. With emit gone, rarely referenced in source. |
| `LoaderEventType` | kept-same (rarely needed) | DELETED: `DataLoadingDelay`→`DataLoadingDelayed`, `AttachmentsLoading*`(plural)→`AttachmentLoading*`(singular) (same value). **DOC BUG: `LoaderEventType.UnknownEventType` is REMOVED** (MIGRATION.md §12 is wrong) → raw `'UNKNOWN_EVENT_TYPE'`. |
| `SyncMode` | kept-same | Root export. INITIAL/INCREMENTAL/LOADING. Replaces removed `ExtractionMode`. |
| `ExtractionMode` | removed-use:`SyncMode` | Deprecated enum removed. |
| `SyncMapperRecordTargetType` | kept-same | Root export (enum). |
| `SyncMapperRecordStatus` | kept-same | Root export (enum). |

## Events / context types

| v1 symbol | Disposition | Action |
|---|---|---|
| `AirdropEvent` | renamed:`AirSyncEvent` | Rename token everywhere. Payload shape identical. If a `CustomAirdropEvent` only added the five identity fields (user_id/dev_oid/source_id/service_account_id/snap_in_id), drop it and read `adapter.event.context.<field>`. |
| `AirdropMessage` | renamed:`AirSyncMessage` | Rename token. |
| `ConnectionData` / `EventContext` / `EventData` / `ExtractorEvent` | kept-same | Kept their v1 names. |
| `EventContextIn` / `EventContextOut` | removed-use:`EventContext` | Deprecated interfaces removed. |
| `EventData.external_sync_units` (field) | removed-use:EXTERNAL_SYNC_UNITS repo | Field deleted. Push ESUs to the repo. |
| `EventData.progress` (field) | removed (no-op) | Field deleted. Drop any `{ progress }` payload; backend computes progress. |
| `ExternalSyncUnit` | kept-same | Root type. |
| `InitialSyncScope` | kept-same / now-root | On root barrel. If deep-imported from `dist/types/extraction`, switch to root; else keep. |

## Repo / item types

| v1 symbol | Disposition | Action |
|---|---|---|
| `RepoInterface` | kept-same | Root export. |
| `NormalizedItem` | kept-same | Root export. |
| `NormalizedAttachment` | kept-same | Root export. |
| `Item` | now-root-import | Was `dist/repo/repo.interfaces`. Now on root barrel — repoint to root. |
| `ItemTypeToLoad` | now-root-import | Was `dist/types/loading`. Now on root barrel. |
| `AirSyncDefaultItemTypes` | kept-same | Root export. Used for the EXTERNAL_SYNC_UNITS repo. |

## Mappers

| v1 symbol | Disposition | Action |
|---|---|---|
| `Mappers` | now-root-import | Was `dist/mappers/mappers`. Now on root barrel. Methods now return the unwrapped body (drop `.data`). For extraction use, construct `new Mappers({ event: adapter.event })`. |
| `MappersGetByTargetIdParams` / `MappersGetByExternalIdParams` / `MappersCreateParams` / `MappersUpdateParams` | kept-same | Root exports. Deep-import caveat: `mappers.interface`(singular)→`mappers.interfaces`(plural). |
| `MappersGetByExternalIdResponse` / `MappersGetByTargetIdResponse` | kept-same (name); NOT on root barrel | Repoint deep import to `dist/mappers/mappers.interfaces` (PLURAL). Methods now RESOLVE to this body directly (not `AxiosResponse<this>`). |

## Axios / HTTP / errors

| v1 symbol | Disposition | Action |
|---|---|---|
| `axios` (SDK re-export) | removed-use:`import axios from 'axios'` | v2 doesn't re-export axios. Preserve any co-imported root symbols as a named import from airsync-sdk. |
| `axiosClient` (retry-wrapped) | removed-use:self-constructed | `const axiosClient = axios.create(); axiosRetry(axiosClient, { retries: 5, retryDelay: axiosRetry.exponentialDelay });`. Add `axios-retry` dep. Keep the name `axiosClient`. Minimal client drops the SDK client's 429-exclusion/auth-header-stripping — replicate + flag only if the connector relied on it. |
| `serializeError` | kept-same | Root export (`./logger/logger`). Returns a **string**. Use it where the result is used as a string. |
| `serializeAxiosError` | **CONDITIONAL** | NOT on the v2 root barrel, but STILL EXISTS internally and returns an **object** (`AxiosErrorResponse`). If the result is spread/property-accessed as an object (`{ ...serializeAxiosError(e) }`) → KEEP it via `import { serializeAxiosError } from '@devrev/airsync-sdk/dist/logger/logger'` (swapping to `serializeError` is a TS2698 spread error). If used as a string → swap to root `serializeError`. |
| `formatAxiosError` | removed-use:`serializeError` | Deleted (string use only). |
| `HTTPResponse` | removed (no replacement) | Replace with a local type or `AxiosResponse` from `'axios'`. |
| `HttpStreamResponse` | kept-same (new public type) | Root type `{ data:any; headers:Record<string,any> }`. Use for a stream annotation instead of SDK `AxiosResponse`. A connector-local alias derived from `ExternalSystemAttachmentStreamingResponse['httpStream']` silently narrows AxiosResponse→this — check over-typed stream literals. |
| `AxiosResponse` (from SDK) | removed-use:`'axios'` or `HttpStreamResponse` | Repoint stream annotations. |

## State

| v1 symbol | Disposition | Action |
|---|---|---|
| `AdapterState` | removed-use:own State type + `adapter.sdkState` | Deprecated flat alias removed. Drop the import. As a bare annotation/param/field type (`state?: AdapterState<S>`), REPLACE with the connector's own State type (`state?: S`) — do NOT delete to `state?:` (invalid TS). SDK fields move to `adapter.sdkState`. |
| `ToDevRev` | drop-import (internal, no replacement) | Was `dist/state/state.interfaces`. SDK-internal now → DROP the import entirely. toDevRev/fromDevRev are under `adapter.sdkState`. |
| `adapter.state.lastSyncStarted` / `lastSuccessfulSyncStarted` | removed (no replacement field) | GONE from `SdkState`. See the transform-catalog §13 DECISION RULE: if the field is declared in the connector's own State interface → RENAME it off the reserved key (keep the mechanism); if it is only accessed loosely on `adapter.state` (SDK-supplied via v1 AdapterState) → DELETE the write / repoint the read to `event_context.extract_from`. Getting this backwards silently breaks incremental sync. |
| `DomainObjectState` / `ErrorLevel` / `LogRecord` / `AdapterUpdateParams` | removed (no replacement) | Deprecated, deleted. Drop any use. |

## Translation helpers (all removed)

| v1 symbol | Disposition | Action |
|---|---|---|
| `translateIncomingEventType` / `translateOutgoingEventType` / `translateExtractorEventType` / `translateLoaderEventType` | removed (no replacement) | The v1 event-type-translation module is deleted; v2 passes `event_type` through untouched. Drop imports/uses. |

## Loading / external system types (all kept)

| v1 symbol | Disposition | Action |
|---|---|---|
| `ExternalSystemItemLoadingResponse` / `ExternalSystemItemLoadingParams` / `ExternalSystemItem` / `ExternalSystemAttachment` / `ExternalSystemAttachmentStreamingParams` / `ExternalSystemAttachmentStreamingResponse` | kept-same | Root types. Per-item create/update functions returning `{id}`/`{error}`/`{delay}` are UNCHANGED. `ExternalSystemAttachmentStreamingResponse.httpStream` is now typed `HttpStreamResponse`. |
| `ExternalSystemAttachmentReducerFunction` / `IteratorFunction` / `ExternalProcessAttachmentFunction` | kept-same | Root types. Only the inner adapter param type changes `WorkerAdapter<C>`→`ExtractionAdapter<C>`. |

## Errors / domain metadata / uploader (kept)

| v1 symbol | Disposition | Action |
|---|---|---|
| `ExtractionCommonError` | kept-same | Root export (moved to `./types/errors` internally; root import unchanged). |
| `UNBOUNDED_DATE_TIME_VALUE` | kept-same | Root export (`'1970-01-01T00:00:00.000Z'`). |
| `installInitialDomainMapping` / `InitialDomainMapping` | kept-same | Root exports. |
| `SpawnFactoryInterface` | kept-same | Root type. `workerPath` field removed from it. |
| `ExternalDomainMetadata` / `Field` / `FieldType` / `CustomStage` / `StageDiagram` / `RecordType` / etc. | kept-same | All external-domain-metadata types are root exports. |
| `Artifact` / `ArtifactsPrepareResponse` / `SsorAttachment` / `StreamAttachmentsResponse` / `StreamResponse` / `UploadResponse` | kept-same | Uploader interface types, root exports. |

## Test support (kept)

| v1 symbol | Disposition | Action |
|---|---|---|
| `MockServer` / `MOCK_SERVER_DEFAULT_URL` | kept-same | Root test-support exports. |
| `createMockEvent` / `DeepPartial` | kept-same | Root test-support exports. |
