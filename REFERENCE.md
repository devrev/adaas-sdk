## Reference

### `SdkState` interface

Defines the base state structure used by the Airdrop SDK.

'SdkState' is an internal member that is not exported.

#### Properties

- _lastSyncStarted_

  Optional. A **string** representing the timestamp when the last sync operation started.

- _lastSuccessfulSyncStarted_

  Optional. A **string** representing the timestamp when the last successful sync operation started.

- _toDevRev_

  Optional. An object of type **ToDevRev** containing data to be sent to DevRev.

- _fromDevRev_

  Optional. An object of type **FromDevRev** containing data received from DevRev.

### `AdapterState` type

A generic type that combines snap-in-specific state with the SDK's base state.

#### Usage

```typescript
type AdapterState<ConnectorState> = ConnectorState & SdkState;
```

The `AdapterState` type extends a snap-in's state type with additional fields from `SdkState`, providing a complete state structure to share with Airdrop platform.

### `ToDevRev` interface

Provides additional information within the state that is available only during data synchronization to DevRev (extraction).

#### Properties

- _attachmentsMetadata_
  - _artifactIds_: An array of **strings** containing artifact IDs
  - _lastProcessed_: A **number** which is the index of the last processed attachment from the array

### `FromDevRev` interface

Provides additional information within the state that is available only during data synchronization from DevRev to external system (loading).

#### Properties

- _filesToLoad_

  An array of **FileToLoad** objects representing files that need to be loaded.

### `StateInterface` interface

Defines the configuration structure for initializing state of the worker adapter.

#### Properties

- _event_

  Required. An object of type **AirdropEvent** that is received from the Airdrop platform.

- _initialState_

  Required. An object of type **ConnectorState** representing the initial state of the snap-in.

- _options_

  Optional. An object of type **WorkerAdapterOptions** for configuring the worker adapter.

### `NormalizedItem` interface

Represents the standardized structure of an item after normalization.

#### Properties

- _id_

  Required. A **string** that uniquely identifies the normalized item.

- _created_date_

  Required. A **string** representing the timestamp, formatted as RFC3339, when the item was created.

- _modified_date_

  Required. A **string** representing the timestamp, formatted as RFC3339, when the item was last modified.

- _data_

  Required. An **object** containing the actual data of the normalized item.

### `NormalizedAttachment` interface

Represents the standardized structure of an attachment after normalization in the Airdrop platform. This interface defines the essential properties needed to identify and link attachments to their parent items.

#### Properties

- _url_

  Required. A **string** representing the URL where the attachment can be accessed.

- _id_

  Required. A **string** that uniquely identifies the normalized attachment.

- _file_name_

  Required. A **string** representing the name of the attachment file.

- _parent_id_

  Required. A **string** identifying the parent item this attachment belongs to.

- _author_id_

  Optional. A **string** identifying the author or creator of the attachment.

- _grand_parent_id_

  Optional. A **number** identifying a higher-level parent entity, if applicable.

#### Example

```typescript
const normalizedAttachment: NormalizedAttachment = {
  url: 'https://example.com/files/document.pdf',
  id: 'att_123456',
  file_name: 'document.pdf',
  parent_id: 'task_789',
  author_id: 'user_456',
  grand_parent_id: 1001,
};
```

### `RepoInterface` interface

Defines the structure of a repo which is used to store and upload extracted data. This interface provides the basic structure for repositories that handle data extraction and normalization.

#### Properties

- _itemType_

  Required. A **string** that specifies the type of items stored in this repository.

- _normalize_

  Optional. A **function** that takes an object and returns either a **NormalizedItem** or **NormalizedAttachment**. This function is responsible for transforming raw data into a standardized format.

#### Example

```typescript
const taskRepo: RepoInterface = {
  itemType: 'tasks',
  normalize: (rawTask) => ({
    id: rawTask.id,
    created_date: rawTask.created_at,
    modified_date: rawTask.updated_at,
    data: rawTask,
  }),
};
```

### `ExternalSyncUnit` interface

Represents an external sync unit (such as repositories, projects, etc.) that can be extracted. This interface defines the structure for organizing and identifying extractable units of data.

#### Properties

- _id_

  Required. A **string** that uniquely identifies the external sync unit.

- _name_

  Required. A **string** representing the name of the external sync unit.

- _description_

  Required. A **string** providing a description of the external sync unit.

- _item_count_

  Optional. A **number** indicating the total count of items in this external sync unit.

- _item_type_

  Optional. A **string** specifying the type of items contained in this external sync unit.

### `EventContext` interface

Defines the structure of the event context that is sent to the external connector from Airdrop.

#### Properties

- _callback_url_

  Required. A **string** representing the callback URL.

- _dev_org_

  Required. A **string** representing the organization ID.

- _dev_org_id_

  Required. A **string** representing the organization ID.

- _dev_user_

  Required. A **string** representing the user ID.

- _dev_user_id_

  Required. A **string** representing the user ID.

- _external_sync_unit_

  Required. A **string** representing the external sync unit ID.

- _external_sync_unit_id_

  Required. A **string** representing the external sync unit ID.

- _external_sync_unit_name_

  Required. A **string** representing the external sync unit name.

- _external_system_

  Required. A **string** representing the external system.

- _external_system_type_

  Required. A **string** representing the external system type.

- _extract_from_

  Optional. A **string** representing the timestamp formatted as RFC3399 from which the extraction should start.

- _import_slug_

  Required. A **string** representing the import slug.

- _initial_sync_scope_

  Optional. An enum **InitialSyncScope** representing the scope of the initial sync (can be 'full-history' or 'time-scoped').

- _mode_

  Required. A **string** representing the mode (can be 'INITIAL', 'INCREMENTAL', or 'LOADING').

- _request_id_

  Required. A **string** representing the request ID.

- _reset_extract_from_

  Optional. A **boolean** signifying the incremental sync should start from the given `extract_from` timestamp if true or from `lastSuccessfulSyncStarted` timestamp if false.

- _snap_in_slug_

  Required. A **string** representing the snap-in slug.

- _snap_in_version_id_

  Required. A **string** representing the snap-in version ID.

- _sync_run_

  Required. A **string** representing the sync run ID.

- _sync_run_id_

  Required. A **string** representing the sync run ID.

- _sync_tier_

  Required. A **string** representing the sync tier.

- _sync_unit_

  Required. A **string** representing the sync unit ID.

- _sync_unit_id_

  Required. A **string** representing the sync unit ID.

- _uuid_

  Required. A **string** representing the unique identifier.

- _worker_data_url_

  Required. A **string** representing the worker data URL.

### `AirdropEvent` interface

Defines the structure of events sent to external extractors from Airdrop platform. This interface encapsulates all necessary information for processing Airdrop events, including authentication, context, and payload data.

#### Properties

- _context_

  Required. An object containing:

  - _secrets_: An object containing:
    - _service_account_token_: A **string** representing the DevRev authentication token for Airdrop platform
  - _snap_in_version_id_: A **string** representing the version ID of the snap-in

- _payload_

  Required. An object of type **AirdropMessage** containing:

  - _connection_data_: An object containing:
    - _org_id_: A **string** representing the organization ID
    - _org_name_: A **string** representing the organization name
    - _key_: A **string** representing the key
    - _key_type_: A **string** representing the key type
  - _event_context_: An object of type [**EventContext**](#EventContext-interface)
  - _event_type_: A value from the **EventType** enum (see `EventType` enum documentation above)
  - _event_data_: Optional. An object that may contain:
    - _external_sync_units_: Optional array of **ExternalSyncUnit** objects
    - _progress_: Optional **number** indicating progress
    - _error_: Optional error record
    - _delay_: Optional **number** indicating delay
    - _reports_: Optional array of loader reports
    - _processed_files_: Optional array of **strings** representing processed files
    - _stats_file_: Optional **string** representing stats file

- _execution_metadata_

  Required. An object containing:

  - _devrev_endpoint_: A **string** representing the DevRev endpoint URL

- _input_data_

  Required. An object containing input data for snap-ins from '@devrev/typescript-sdk'

### `EventData` interface

Defines the structure of event data that is sent from the external extractor to Airdrop. This interface encapsulates various types of data that can be included in events, such as progress updates, errors, and processing results.

#### Properties

- _external_sync_units_

  Optional. An array of **ExternalSyncUnit** objects representing external sync units to be processed.

- _progress_

  Optional. A **number** indicating the progress of the current operation.

- _error_

  Optional. An object of type **ErrorRecord** containing error information if an error occurred.

- _delay_

  Optional. A **number** specifying a delay duration in seconds.

### `spawn` function

This function initializes a new worker thread and oversees its lifecycle. It should be invoked when the snap-in receives a message from the Airdrop platform. The worker script provided then handles the event accordingly.

#### Usage

```typescript
spawn({ event, initialState, workerPath, options });
```

#### Parameters

- _event_

  Required. An object of type **AirdropEvent** that is received from the Airdrop platform.

- _initialState_

  Required. Object of **any** type that represents the initial state of the snap-in.

- _workerPath_

  Required. A **string** that represents the path to the worker file.

- _options_

  Optional. An object of type **WorkerAdapterOptions**, which will be passed to the newly created worker. This worker will then initialize a `WorkerAdapter` by invoking the `processTask` function. The options include:

  - `isLocalDevelopment`

    A **boolean** flag. If set to `true`, intermediary files containing extracted data will be stored on the local machine, which is useful during development. The default value is `false`.

  - `timeout`

    A **number** that specifies the timeout duration for the lambda function, in milliseconds. The default is 10 minutes (10 _ 60 _ 1000 milliseconds), with a maximum allowable duration of 13 minutes (13 _ 60 _ 1000 milliseconds).

  - `batchSize`

    A **number** that determines the maximum number of items to be processed and saved to an intermediary file before being sent to the Airdrop platform. The default batch size is 2,000.

#### Return value

A **promise** that resolves once the worker has completed processing.

#### Example

```typescript
const run = async (events: AirdropEvent[]) => {
  for (const event of events) {
    const file = getWorkerPerExtractionPhase(event);
    await spawn<ExtractorState>({
      event,
      initialState,
      workerPath: file,
    });
  }
};
```

### `processTask` function

The `processTask` function retrieves the current state from the Airdrop platform and initializes a new `WorkerAdapter`. It executes the code specified in the `task` parameter, which contains the worker's functionality. If a timeout occurs, the function handles it by executing the `onTimeout` callback, ensuring the worker exits gracefully. Both functions receive an `adapter` parameter, representing the initialized `WorkerAdapter` object.

#### Usage

```typescript
processTask({ task, onTimeout });
```

#### Parameters

- _task_

  Required. A **function** that defines the logic associated with the given event type.

- _onTimeout_

  Required. A **function** managing the timeout of the lambda invocation, including saving any necessary progress at the time of timeout.

#### Example

```typescript
// External sync units extraction
processTask({
  task: async ({ adapter }) => {
    const httpClient = new HttpClient(adapter.event);

    const todoLists = await httpClient.getTodoLists();

    const externalSyncUnits: ExternalSyncUnit[] = todoLists.map((todoList) =>
      normalizeTodoList(todoList)
    );

    await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsDone, {
      external_sync_units: externalSyncUnits,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsError, {
      error: {
        message: 'Failed to extract external sync units. Lambda timeout.',
      },
    });
  },
});
```

### `Spawn` class

`Spawn` class is responsible for spawning a new worker thread and managing the lifecycle of the worker. Provides utilities to emit control events to the platform and exit the worker gracefully. In case of lambda timeout, the class emits a lambda timeout event to the platform.

#### Usage

```typescript
new Spawn({
  event,
  worker,
  options,
  resolve,
});
```

#### Parameters

- _event_

  Required. An object of type **AirdropEvent** that is received from the Airdrop platform.

- _worker_

  Required. A Node worker of the **Worker** class, created with the createWorker function, which represents an independent JavaScript execution thread.

- _options_

  Optional. An object of type **SpawnInterface**, which defines the options to create a new instance of Spawn class.

- _resolve_

  Required. A resolve **function** for the promise inside which the Spawn class was created.

#### Example

```typescript
new Promise((resolve) => {
  new Spawn({
    event,
    worker,
    options,
    resolve,
  });
});
```

### `WorkerAdapter` class

Used to interact with Airdrop platform. Provides utilities to emit events to the Airdrop platform, update the state of the snap-in and upload artifacts (files with data) to the platform.

### Usage

```typescript
new WorkerAdapter({
  event,
  adapterState,
  options,
});
```

#### Parameters

- _event_

  Required. An object of type **AirdropEvent** that is received from the Airdrop platform.

- _adapterState_

  Required. An object of type **State**, which represents the initial state of the adapter.

- _options_

  Optional. An object of type **WorkerAdapterOptions** that specifies additional configuration options for the `WorkerAdapter`. This object is passed via the `spawn` function.

#### Example

```typescript
const adapter = new WorkerAdapter<ConnectorState>({
  event,
  adapterState,
  options,
});
```

### `WorkerAdapter.state` property

Getter and setter methods for working with the adapter state.

### Usage

```typescript
// get state
const adapterState = adapter.state;

// set state
adapter.state = newAdapterState;
```

#### Example

```typescript
export const initialState: ExtractorState = {
  users: { completed: false },
  tasks: { completed: false },
  attachments: { completed: false },
};

adapter.state = initialState;
```

### `WorkerAdapter.initializeRepos` method

Initializes a `Repo` object for each item provided.

### Usage

```typescript
adapter.initializeRepos(repos);
```

#### Parameters

- _repos_

  Required. An array of objects of type `RepoInterface`.

#### Example

This should typically be called within the function passed as a parameter to the `processTask` function in the data extraction phase.

```typescript
const repos = [
  {
    itemType: 'tasks',
    normalize: normalizeTask,
  },
];

adapter.initializeRepos(repos);
```

### `WorkerAdapter.getRepo` method

Finds a Repo from the initialized repos.

### Usage

```typescript
adapter.getRepo(itemType);
```

#### Parameters

- _itemType_

  Required. A **string** that represents the itemType property for the searched repo.

#### Return value

An object of type **Repo** if the repo is found, otherwise **undefined**.

#### Example

This should typically be called within the function passed as a parameter to the `processTask` function.

```typescript
// Push users to the repository designated for 'users' data.
await adapter.getRepo('users')?.push(users);
```

### `WorkerAdapter.emit` method

Emits an event to the Airdrop platform.

### Usage

```typescript
adapter.emit( newEventType, data ):
```

#### Parameters

- _newEventType_

  Required. The event type to be emitted, of type **ExtractorEventType** or **LoaderEventType**.

- _data_

  Optional. An object of type **EventData** which represents the data to be sent with the event.

#### Return value

A **promise**, which resolves to undefined after the emit function completes its execution or rejects with an error.

#### Example

This should typically be called within the function passed as a parameter to the `processTask` function.

```typescript
// Emitting successfully finished data extraction.
await adapter.emit(ExtractorEventType.ExtractionDataDone);

// Emitting a delay in attachments extraction phase.
await adapter.emit(ExtractorEventType.ExtractionAttachmentsDelay, {
  delay: 10,
});
```
