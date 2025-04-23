# Airdrop SDK

[![Coverage Status](https://coveralls.io/repos/github/devrev/adaas-sdk/badge.svg?branch=main&t=s4Otlm)](https://coveralls.io/github/devrev/adaas-sdk?branch=main)

## Overview

The Airdrop SDK for TypeScript helps developers build snap-ins that integrate with DevRev’s Airdrop platform. 
This SDK simplifies the workflow for handling data extraction and loading, event-driven actions, state management, and artifact handling.

It provides features such as:

- Type Definitions: Structured types for Airdrop control protocol
- Event Management: Easily emit events for different extraction or loading phases
- State Handling: Update and access state in real-time within tasks
- Artifact Management: Supports batched storage of artifacts
- Error & Timeout Support: Error handling and timeout management for long-running tasks

## Installation

```bash
npm install @devrev/ts-adaas
```

## Reference

### `spawn` function

This function initializes a new worker thread and oversees its lifecycle. 
It should be invoked when the snap-in receives a message from the Airdrop platform.
The worker script provided then handles the event accordingly.

#### Usage

```typescript
spawn({ event, initialState, workerPath, options })
```

#### Parameters

* _event_
  
  Required. An object of type __AirdropEvent__ that is received from the Airdrop platform.

* _initialState_

  Required. Object of __any__ type that represents the initial state of the snap-in.

* _workerPath_

  Required. A __string__ that represents the path to the worker file.

* _options_

  Optional. An object of type **WorkerAdapterOptions**, which will be passed to the newly created worker. This worker will then initialize a `WorkerAdapter` by invoking the `processTask` function. The options include:
  
  * `isLocalDevelopment`
  
    A __boolean__ flag. If set to `true`, intermediary files containing extracted data will be stored on the local machine, which is useful during development. The default value is `false`.

  * `timeout`
  
    A __number__ that specifies the timeout duration for the lambda function, in milliseconds. The default is 10 minutes (10 * 60 * 1000 milliseconds), with a maximum allowable duration of 13 minutes (13 * 60 * 1000 milliseconds).
  
  * `batchSize`

    A __number__ that determines the maximum number of items to be processed and saved to an intermediary file before being sent to the Airdrop platform. The default batch size is 2,000.

#### Return value

A __promise__ that resolves once the worker has completed processing.

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

The `processTask` function retrieves the current state from the Airdrop platform and initializes a new `WorkerAdapter`.
It executes the code specified in the `task` parameter, which contains the worker's functionality.
If a timeout occurs, the function handles it by executing the `onTimeout` callback, ensuring the worker exits gracefully.
Both functions receive an `adapter` parameter, representing the initialized `WorkerAdapter` object.


#### Usage
```typescript
processTask({ task, onTimeout })
```

#### Parameters

* _task_
  
  Required. A __function__ that defines the logic associated with the given event type.

* _onTimeout_
  
  Required. A __function__ managing the timeout of the lambda invocation, including saving any necessary progress at the time of timeout.

#### Example

````typescript
// External sync units extraction
processTask({
  task: async ({ adapter }) => {
    const httpClient = new HttpClient(adapter.event);

    const todoLists = await httpClient.getTodoLists();

    const externalSyncUnits: ExternalSyncUnit[] = todoLists.map((todoList) => normalizeTodoList(todoList));

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
````

### `WorkerAdapter` class

Used to interact with Airdrop platform. 
Provides utilities to emit events to the Airdrop platform, update the state of the snap-in and upload artifacts (files with data) to the platform.

### Usage

```typescript
new WorkerAdapter({
  event,
  adapterState,
  options,
});
```

#### Parameters

* _event_
  
  Required. An object of type __AirdropEvent__ that is received from the Airdrop platform.

* _adapterState_
  
  Required. An object of type __State__, which represents the initial state of the adapter.

* _options_
  
  Optional. An object of type __WorkerAdapterOptions__ that specifies additional configuration options for the `WorkerAdapter`. This object is passed via the `spawn` function.

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

* _repos_
  
  Required. An array of objects of type `RepoInterface`. 

#### Example

This should typically be called within the function passed as a parameter to the `processTask` function in the data extraction phase.

```typescript
const repos = [
  {
    itemType: 'tasks',
    normalize: normalizeTask,
  }
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

* _itemType_
  
  Required. A __string__ that represents the itemType property for the searched repo.

#### Return value

An object of type __Repo__ if the repo is found, otherwise __undefined__.

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

* _newEventType_
  
  Required. The event type to be emitted, of type __ExtractorEventType__ or __LoaderEventType__.

* _data_
  
  Optional. An object of type __EventData__ which represents the data to be sent with the event.

#### Return value

A __promise__, which resolves to undefined after the emit function completes its execution or rejects with an error.

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
