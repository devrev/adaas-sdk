# ADaaS Library

Typescript ADaaS Library (@devrev/ts-adaas) provides:

- type definitions for ADaaS control protocol,
- an adapter for ADaaS control protocol,
- helpers for uploading artifacts and manage the state for ADaaS snap-in.

## Release Notes

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

## Usage

Create a new ADaaS adapter on each ADaaS snap-in invocation:

```javascript
const adapter = new Adapter(event: AirdropEvent);
```

Adapter class provides:

- helper function to emit response,
- automatic emit event if ADaaS snap-in invocation runs out of time,
- setter for updating ADaaS snap-in state and adding artifacts to the return ADaaS message.

### Phases of Airdrop Extraction

Each ADaaS snap-in must handle all the phases of ADaaS extraction.

ADaaS library provides type definitions to ensure ADaaS snap-ins are compatible with ADaaS control protocol.

```javascript
async run() {
  switch (this.event.payload.event_type) {
    case EventType.ExtractionExternalSyncUnitsStart: {

      // extract available External Sync Units (projects, organizations, ...)

      await this.adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsDone, {
        external_sync_units: externalSyncUnits,
      });
      break;
    }

    case EventType.ExtractionMetadataStart: {

      // provide mappings of domain objects by provioding initial_domain_mapping.json file
      // update ADaaS snap-in state

      await this.adapter.emit(ExtractorEventType.ExtractionMetadataDone);
      break;
    }

    case EventType.ExtractionDataStart: {

      // extract Data
      // upload Data
      // update ADaaS snap-in state
      // approximate progress done

      await this.adapter.emit(ExtractorEventType.ExtractionDataContinue, {
        progress: 10,
      });

      break;
    }

    case EventType.ExtractionDataContinue: {
      await this.processExtractionData();

      // extract Data
      // upload Data
      // update ADaaS snap-in state
      // approximate progress done

      await this.adapter.emit(ExtractorEventType.ExtractionDataDone, {
        progress: 100,
      });
      break;
    }

    case EventType.ExtractionDataDelete: {

      // if an extraction has any side-effects to 3rd party systems cleanup should be done here.

      await this.adapter.emit(ExtractorEventType.ExtractionDataDeleteDone);
      break;
    }

    case EventType.ExtractionAttachmentsStart: {

      // extract Attachments
      // upload Attachments
      // update ADaaS snap-in state

      await this.adapter.emit(ExtractorEventType.ExtractionAttachmentsContinue);
      break;
    }

    case EventType.ExtractionAttachmentsContinue: {


      // extract Attachments
      // upload Attachments
      // update ADaaS snap-in state

      await this.adapter.emit(ExtractorEventType.ExtractionAttachmentsDone);
      break;
    }

    case EventType.ExtractionAttachmentsDelete: {

      // if an extraction has any side-effects to 3rd party systems cleanup should be done here.

      await this.adapter.emit(ExtractorEventType.ExtractionAttachmentsDeleteDone);
      break;
    }

    default: {
      console.log('Event not supported' + JSON.stringify(this.event));
    }
  }
}
```

## Uploading artifacts

Create a new Uploader class for uploading artifacts:

```javascript
const upload = new Uploader(
  event.execution_metadata.devrev_endpoint,
  event.context.secrets.service_account_token
);
```

Files with extracted domain objects must be in JSONL (JSON Lines) format. Data files should contain 2000 - 5000 records each.

```javascript
const entity = 'users';
const { artifact, error } = await this.uploader.upload(
  `extractor_${entity}_${i}.jsonl`,
  entity,
  data
);
if (error) {
  return error;
} else {
  await this.adapter.update({ artifact });
}
```

Each uploaded file must be attached to ADaaS adapter as soon as it is uploaded to ensure it is included in the ADaaS response message in case of a lambda timeout.

## Updating ADaaS snap-in state

ADaaS snap-ins keep their own state between sync runs, between the states of a particular sync run and between invocations within a particular state.

By managing its own state, the ADaaS snap-in keeps track of the process of extraction (what items have already been extracted and where to continue), the times of the last successful sync run and keeps record of progress of the extraction.

```typescript
    async update({ artifacts, extractor_state}: AdapterUpdateParams)
```
