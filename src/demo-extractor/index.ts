import {
  AirdropEvent,
  EventType,
  ExternalSyncUnit,
  ExtractorEventType,
} from '../types';

import { Adapter } from '../adapter';
import { Uploader } from '../uploader';

import recipeJson from './recipe.json';

export class DemoExtractor {
  async run(event: AirdropEvent) {
    console.log(
      'Event in DemoExtractor run function: ' + JSON.stringify(event)
    );

    const adapter = new Adapter(event);
    const uploader = new Uploader(
      event.execution_metadata.devrev_endpoint,
      event.context.secrets["service_account_token"]
    );

    switch (event.payload.event_type) {
      case EventType.ExtractionExternalSyncUnitsStart: {
        const externalSyncUnits: ExternalSyncUnit[] = [
          {
            id: 'devrev',
            name: 'devrev',
            description: 'Loopback for DevRev',
            item_count: 0,
          },
        ];

        await adapter.emit(ExtractorEventType.ExtractionExternalSyncUnitsDone, {
          external_sync_units: externalSyncUnits,
        });

        break;
      }

      case EventType.ExtractionMetadataStart: {
        const metadata = [
          {
            item: 'contacts',
            fields: ['name', 'lastName'],
          },
          {
            item: 'users',
            fields: ['name', 'lastName'],
          },
        ];

        const { artifact, error } = await uploader.upload(
          'loopback_metadata_1.jsonl',
          'metadata',
          metadata
        );

        if (error) {
          await adapter.emit(ExtractorEventType.ExtractionMetadataError, {
            error,
          });
        } else {
          await adapter.update({ artifact });
          await adapter.emit(ExtractorEventType.ExtractionMetadataDone);
        }

        break;
      }

      case EventType.ExtractionDataStart: {
        const contacts = [
          {
            name: 'John',
            lastName: 'Doe',
          },
          {
            name: 'Jane',
            lastName: 'Doe',
          },
        ];

        const { artifact, error } = await uploader.upload(
          'loopback_contacts_1.json',
          'contacts',
          contacts
        );

        if (error) {
          await adapter.emit(ExtractorEventType.ExtractionDataError, {
            error,
          });
        } else {
          await adapter.update({ artifact });
          await adapter.emit(ExtractorEventType.ExtractionDataProgress, {
            progress: 50,
          });
        }

        break;
      }

      case EventType.ExtractionDataContinue: {
        const users = [
          {
            name: 'John',
            lastName: 'Phd',
          },
          {
            name: 'Jane',
            lastName: 'Phd',
          },
        ];

        const { artifact, error } = await uploader.upload(
          'loopback_users_1.json',
          'users',
          users
        );

        if (error) {
          await adapter.emit(ExtractorEventType.ExtractionDataError, {
            error,
          });
        } else {
          await adapter.update({ artifact });

          // TODO: Add separated function for uploading recipe.json?
          const { artifact: recipe, error } = await uploader.upload(
            'recipe.json',
            'initial_domain_mapping',
            recipeJson
          );
          await adapter.update({ artifact: recipe });

          await adapter.emit(ExtractorEventType.ExtractionDataDone, {
            progress: 100,
          });
        }

        break;
      }

      case EventType.ExtractionDataDelete: {
        await adapter.emit(ExtractorEventType.ExtractionDataDeleteDone);
        break;
      }

      case EventType.ExtractionAttachmentsStart: {
        const attachment1 = ['This is attachment1.txt content'];
        const { artifact, error } = await uploader.upload(
          'attachment1.txt',
          'attachment',
          attachment1
        );

        if (error) {
          await adapter.emit(ExtractorEventType.ExtractionAttachmentsError, {
            error,
          });
        } else {
          await adapter.update({ artifact });
          await adapter.emit(ExtractorEventType.ExtractionAttachmentsProgress);
        }
        break;
      }

      case EventType.ExtractionAttachmentsContinue: {
        const attachment2 = ['This is attachment2.txt content'];
        const { artifact, error } = await uploader.upload(
          'attachment2.txt',
          'attachment',
          attachment2
        );

        if (error) {
          await adapter.emit(ExtractorEventType.ExtractionAttachmentsError, {
            error,
          });
        } else {
          await adapter.update({ artifact });
          await adapter.emit(ExtractorEventType.ExtractionAttachmentsDone);
        }

        break;
      }

      case EventType.ExtractionAttachmentsDelete: {
        await adapter.emit(ExtractorEventType.ExtractionAttachmentsDeleteDone);
        break;
      }

      default: {
        console.log(
          'Event in DemoExtractor run not recognized: ' + JSON.stringify(event)
        );
      }
    }
  }
}
