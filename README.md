# ADaaS Library

## Release Notes

### v1.2.4

- Do not fail the extraction of attachments if streaming of single attachment fails.

### v1.2.3

- Add `local` flag to use for local development of the ADaaS snap-ins.
- Send library version, snap-in version and snap-in slug in headers while emitting.
- Make `actor_id` field optional for `SsorAttachment` interface.
- Fix bugs related to event handling, error logging.

### v1.2.2

- Add library version as a part of control protocol.
- Improve axios client and adapter logging.
- Fix bugs related to state handling.

### v1.2.1

- Reduced the `delayFactor` to minimize unnecessary delays.
- Correct the setting of the `lastSyncStarted` timestamp.
- Improve logging for attachment extraction and loading.
- Fix several bugs related to the control protocol.

### v1.2.0

- Add support for loading attachments from DevRev to external system.

### v1.1.6

- Add exponential retry and handle rate-limiting towards DevRev.
- Gracefully handle failure to upload extracted attachments.

### v1.1.5

- Increase `delayFactor` and number of retries for the exponential backoff retry mechanism for HTTP requests.
- Provide an inject function for streaming attachments.
- Fix the attachments streaming bug.

### v1.1.4

- Provide log lines and stack traces for runtime worker errors.

### v1.1.3

- Export `axios` and `axiosClient` with the exponential backoff retry mechanism for HTTP requests and omit Authorization headers from Axios errors.
- Resolve circular structure logging issues.
- Fix the attachments metadata normalization bug.
- Improve repository logging.

### v1.1.2

- Unify incoming and outgoing event context.
- Add `dev_oid` to logger tags.

### v1.1.1

- Add default workers for loading deletion events.

### v1.1.0

- Support sync from DevRev to the external system. (Known limitations: no support for loading attachments.)

### v1.0.4

- Fix logging from worker threads.

### v1.0.3

- Add release notes.

### v1.0.2

- Fix bugs and improve local development.
- Expose `formatAxiosError` function for error handling.

### v1.0.1

- Fix bugs and improve logging.

### v1.0.0

- Enable extractions to use the full lambda runtime and gracefully handle execution context timeout.
- Simplify metadata and data normalization and uploading with the repo implementation.
- Provide default handling of the attachment extraction phase in the ADaaS SDK library.
- Reduce file size and streamline processes with gzip compression.
- Fix bugs and improve error handling.

### v0.0.3

- Support new recipe management.

### v0.0.2

- Support the State API.
- Provide an HTTP client for API requests.
- Create local artifact files in the local development environment.
- Improve logging.

### v0.0.1

- Implement a demo of the ADaaS snap-in.
- Add an adapter for the ADaaS control protocol with helper functions.
- Provide an uploader for uploading artifacts.

# Overview

[![Coverage Status](https://coveralls.io/repos/github/devrev/adaas-sdk/badge.svg?branch=main&t=s4Otlm)](https://coveralls.io/github/devrev/adaas-sdk?branch=main)

The ADaaS (Airdrop-as-a-Service) Library for TypeScript helps developers build Snap-ins that integrate with DevRev’s ADaaS platform. This library simplifies the workflow for handling data extraction and loading, event-driven actions, state management, and artifact handling.

It provides features such as:

- Type Definitions: Structured types for ADaaS control protocol
- Event Management: Easily emit events for different extraction or loading phases
- State Handling: Update and access state in real-time within tasks
- Artifact Management: Supports batched storage of artifacts
- Error & Timeout Support: Error handling and timeout management for long-running tasks

# Installation

```bash
npm install @devrev/ts-adaas
```

# Usage

ADaaS Snap-ins can import data in both directions: from external sources to DevRev and from DevRev to external sources. Both directions are composed of several phases.

From external source to DevRev:

- External Sync Units Extraction
- Metadata Extraction
- Data Extraction
- Attachments Extraction

From DevRev to external source:

- Data Loading

Each phase comes with unique requirements for processing task, and both timeout and error handling.

The ADaaS library exports processTask to structure the work within each phase, and onTimeout function to handle timeouts.

### ADaaS Snap-in Invocation

Each ADaaS snap-in must handle all the phases of ADaaS extraction. In a Snap-in, you typically define a `run` function that iterates over events and invokes workers per extraction phase.

```typescript
import { AirdropEvent, EventType, spawn } from '@devrev/ts-adaas';

interface DummyExtractorState {
  issues: { completed: boolean };
  users: { completed: boolean };
  attachments: { completed: boolean };
}

const initialState: DummyExtractorState = {
  issues: { completed: false },
  users: { completed: false },
  attachments: { completed: false },
};

function getWorkerPerExtractionPhase(event: AirdropEvent) {
  let path;
  switch (event.payload.event_type) {
    case EventType.ExtractionExternalSyncUnitsStart:
      path = __dirname + '/workers/external-sync-units-extraction';
      break;
    case EventType.ExtractionMetadataStart:
      path = __dirname + '/workers/metadata-extraction';
      break;
    case EventType.ExtractionDataStart:
    case EventType.ExtractionDataContinue:
      path = __dirname + '/workers/data-extraction';
      break;
  }
  return path;
}

const run = async (events: AirdropEvent[]) => {
  for (const event of events) {
    const file = getWorkerPerExtractionPhase(event);
    await spawn<DummyExtractorState>({
      event,
      initialState,
      workerPath: file,
      options: {
        isLocalDevelopment: true,
      },
    });
  }
};

export default run;
```

## Extraction

The ADaaS snap-in extraction lifecycle consists of three main phases: External Sync Units Extraction, Metadata Extraction, and Data Extraction. Each phase is defined in a separate file and is responsible for fetching the respective data.

The ADaaS library provides a repository management system to handle artifacts in batches. The `initializeRepos` function initializes the repositories, and the `push` function uploads the artifacts to the repositories. The `postState` function is used to post the state of the extraction task.

State management is crucial for ADaaS Snap-ins to maintain the state of the extraction task. The `postState` function is used to post the state of the extraction task. The state is stored in the adapter and can be retrieved using the `adapter.state` property.

### 1. External Sync Units Extraction

This phase is defined in `external-sync-units-extraction.ts` and is responsible for fetching the external sync units.

```typescript
import {
  ExternalSyncUnit,
  ExtractorEventType,
  processTask,
} from '@devrev/ts-adaas';

const externalSyncUnits: ExternalSyncUnit[] = [
  {
    id: 'devrev',
    name: 'devrev',
    description: 'Demo external sync unit',
    item_count: 2,
    item_type: 'issues',
  },
];

processTask({
  task: async ({ adapter }) => {
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

### 2. Metadata Extraction

This phase is defined in `metadata-extraction.ts` and is responsible for fetching the metadata.

```typescript
import { ExtractorEventType, processTask } from '@devrev/ts-adaas';
import externalDomainMetadata from '../dummy-extractor/external_domain_metadata.json';

const repos = [{ itemType: 'external_domain_metadata' }];

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);
    await adapter
      .getRepo('external_domain_metadata')
      ?.push([externalDomainMetadata]);
    await adapter.emit(ExtractorEventType.ExtractionMetadataDone);
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
      error: { message: 'Failed to extract metadata. Lambda timeout.' },
    });
  },
});
```

### 3. Data Extraction

This phase is defined in `data-extraction.ts` and is responsible for fetching the data. In this phase also attachments metadata is extracted.

```typescript
import { EventType, ExtractorEventType, processTask } from '@devrev/ts-adaas';
import { normalizeAttachment, normalizeIssue, normalizeUser } from '../dummy-extractor/data-normalization';

const issues = [
  { id: 'issue-1', created_date: '1999-12-25T01:00:03+01:00', ... },
  { id: 'issue-2', created_date: '1999-12-27T15:31:34+01:00', ... },
];

const users = [
  { id: 'user-1', created_date: '1999-12-25T01:00:03+01:00', ... },
  { id: 'user-2', created_date: '1999-12-27T15:31:34+01:00', ... },
];

const attachments = [
  { url: 'https://app.dev.devrev-eng.ai/favicon.ico', id: 'attachment-1', ... },
  { url: 'https://app.dev.devrev-eng.ai/favicon.ico', id: 'attachment-2', ... },
];

const repos = [
  { itemType: 'issues', normalize: normalizeIssue },
  { itemType: 'users', normalize: normalizeUser },
  { itemType: 'attachments', normalize: normalizeAttachment },
];

processTask({
  task: async ({ adapter }) => {
    adapter.initializeRepos(repos);

    if (adapter.event.payload.event_type === EventType.ExtractionDataStart) {
      await adapter.getRepo('issues')?.push(issues);
      await adapter.emit(ExtractorEventType.ExtractionDataProgress, { progress: 50 });
    } else {
      await adapter.getRepo('users')?.push(users);
      await adapter.getRepo('attachments')?.push(attachments);
      await adapter.emit(ExtractorEventType.ExtractionDataDone, { progress: 100 });
    }
  },
  onTimeout: async ({ adapter }) => {
    await adapter.postState();
    await adapter.emit(ExtractorEventType.ExtractionDataProgress, { progress: 50 });
  },
});
```

### 4. Attachments Streaming

The ADaaS library handles attachments streaming to improve efficiency and reduce complexity for developers. During the extraction phase, developers need only to provide metadata in a specific format for each attachment, and the library manages the streaming process.

The Snap-in should provide attachment metadata following the `NormalizedAttachment` interface:

```typescript
export interface NormalizedAttachment {
  url: string;
  id: string;
  file_name: string;
  author_id: string;
  parent_id: string;
}
```

## Loading phases

### 1. Loading Data

This phase is defined in `load-data.ts` and is responsible for loading the data to the external system.

Loading is done by providing an ordered list of itemTypes to load and their respective create and update functions.

```typescript
  processTask({
    task: async ({ adapter }) => {
      const { reports, processed_files } = await adapter.loadItemTypes({
        itemTypesToLoad: [
          {
            itemType: 'tickets',
            create: createTicket,
            update: updateTicket,
          },
          {
            itemType: 'conversations',
            create: createConversation,
            update: updateConversation,
          },
        ],
      });

    await adapter.emit(LoaderEventType.DataLoadingDone, {
      reports,
      processed_files,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.emit(LoaderEventType.DataLoadingProgress, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
});
```

The loading functions `create` and `update` provide loading to the external system. They provide denormalization of the records to the schema of the external system and provide HTTP calls to the external system. Both loading functions must handle rate limiting for the external system and handle errors.

Functions return an ID and modified date of the record in the external system, or specify rate-liming offset or errors, if the record could not be created or updated.

### 2. Loading Attachments

This phase is defined in `load-attachments.ts` and is responsible for loading the attachments to the external system.

Loading is done by providing the create function to create attachments in the external system.

```typescript
processTask({
  task: async ({ adapter }) => {
    const { reports, processed_files } = await adapter.loadAttachments({
      create,
    });

    await adapter.emit(LoaderEventType.AttachmentLoadingDone, {
      reports,
      processed_files,
    });
  },
  onTimeout: async ({ adapter }) => {
    await adapter.postState();
    await adapter.emit(LoaderEventType.AttachmentLoadingProgress, {
      reports: adapter.reports,
      processed_files: adapter.processedFiles,
    });
  },
});
```

The loading function `create` provides loading to the external system, to make API calls to the external system to create the attachments and handle errors and external system's rate limiting.

Functions return an ID and modified date of the record in the external system, specify rate-liming back-off, or log errors, if the attachment could not be created.
