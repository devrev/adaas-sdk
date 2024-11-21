# ADaaS Library

## Release Notes

#### v1.0.1

- Bug fixes and improvements in logging.

#### v1.0.0

- Allow extractions to use full lambda runtime and gracefully handle execution context timeout.
- Simplified metadata and data normalization and uploading with repo implementation.
- Default handling of attachment extraction phase in ADaaS SDK library.
- Reduced file size, streamlined process by gzip compression.
- Bug fixes and improvements in error handling.

#### v0.0.3

- Support for new recipe management

#### v0.0.2

- Support for the State API
- HTTP client for API requests
- Local development environment creates local artifact files
- Improvements in logging

#### v0.0.1

- Demo implementation of ADaaS snap-in
- Adapter for ADaaS control protocol with helper functions
- Uploader for uploading artifacts

# Overview

The ADaaS (Airdrop-as-a-Service) Library for TypeScript helps developers build Snap-ins that integrate with DevRev’s ADaaS platform. This library simplifies the workflow for handling data extraction, event-driven actions, state management, and artifact handling.

## Features

- Type Definitions: Structured types for ADaaS control protocol
- Event Management: Easily emit events for different extraction phases
- State Handling: Update and access state in real-time within tasks
- Artifact Management: Supports batched storage of artifacts (2000 items per batch)
- Error & Timeout Support: Error handling and timeout management for long-running tasks

# Installation

```bash
npm install @devrev/ts-adaas
```

# Usage

ADaaS Snap-ins are composed of several phases, each with unique requirements for initialization, data extraction, and error handling. The ADaaS library exports processTask to structure the work within each phase. The processTask function accepts task and onTimeout handlers, giving access to the adapter to streamline state updates, upload of extracted data, and event emission.

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

## Extraction Phases

The ADaaS snap-in extraction lifecycle consists of three main phases: External Sync Units Extraction, Metadata Extraction, and Data Extraction. Each phase is defined in a separate file and is responsible for fetching the respective data.

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

## 4. Attachments Streaming

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

## Artifact Uploading and State Management

The ADaaS library provides a repository management system to handle artifacts in batches. The `initializeRepos` function initializes the repositories, and the `push` function uploads the artifacts to the repositories. The `postState` function is used to post the state of the extraction task.

State management is crucial for ADaaS Snap-ins to maintain the state of the extraction task. The `postState` function is used to post the state of the extraction task. The state is stored in the adapter and can be retrieved using the `adapter.state` property.

## Timeout Handling

The ADaaS library provides a timeout handler to handle timeouts in long-running tasks. The `onTimeout` handler is called when the task exceeds the timeout limit. The handler can be used to post the state of the extraction task and emit an event when a timeout occurs.
