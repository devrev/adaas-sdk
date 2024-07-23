import {
  AirdropEvent,
  EventType,
  ExternalSyncUnit,
  ExtractorEventType,
} from '../types';

import { Adapter } from '../adapter';
import { Uploader } from '../uploader';

import extractorInitialDomainMapping from './initial_domain_mapping.json';

type ExtractorState = object;

export class DemoExtractor {
  private event: AirdropEvent;
  private adapter: Adapter<ExtractorState>;
  private uploader: Uploader;

  constructor(event: AirdropEvent, adapter: Adapter<ExtractorState>) {
    this.event = event;
    this.adapter = adapter;
    this.uploader = new Uploader(
      this.event.execution_metadata.devrev_endpoint,
      this.event.context.secrets.service_account_token
    );
  }

  async run() {
    switch (this.event.payload.event_type) {
      case EventType.ExtractionExternalSyncUnitsStart: {
        const externalSyncUnits: ExternalSyncUnit[] = [
          {
            id: 'devrev',
            name: 'devrev',
            description: 'Demo external sync unit',
          },
        ];

        await this.adapter.emit(
          ExtractorEventType.ExtractionExternalSyncUnitsDone,
          {
            external_sync_units: externalSyncUnits,
          }
        );

        break;
      }

      case EventType.ExtractionMetadataStart: {
        const metadata = [
          {
            item: 'contacts',
            fields: ['id', 'name', 'lastName'],
          },
          {
            item: 'users',
            fields: ['id', 'name', 'lastName'],
          },
        ];

        const { artifact, error } = await this.uploader.upload(
          'loopback_metadata_1.jsonl',
          'metadata',
          metadata
        );

        if (error || !artifact) {
          await this.adapter.emit(ExtractorEventType.ExtractionMetadataError, {
            error,
          });
          return;
        }

        const { artifact: recipe, error: recipeError } =
          await this.uploader.upload(
            'recipe.json',
            'initial_domain_mapping',
            extractorInitialDomainMapping
          );

        if (recipeError || !recipe) {
          await this.adapter.emit(ExtractorEventType.ExtractionMetadataError, {
            error: recipeError,
          });
          return;
        }

        await this.adapter.emit(ExtractorEventType.ExtractionMetadataDone, {
          progress: 50,
          artifacts: [artifact, recipe],
        });

        break;
      }

      case EventType.ExtractionDataStart: {
        const contacts = [
          {
            id: 1,
            name: 'John',
            lastName: 'Doe',
          },
          {
            id: 2,
            name: 'Jane',
            lastName: 'Doe',
          },
        ];

        const { artifact, error } = await this.uploader.upload(
          'loopback_contacts_1.json',
          'contacts',
          contacts
        );

        if (error || !artifact) {
          await this.adapter.emit(ExtractorEventType.ExtractionDataError, {
            error,
          });

          return;
        }

        await this.adapter.emit(ExtractorEventType.ExtractionDataProgress, {
          progress: 50,
          artifacts: [artifact],
        });

        break;
      }

      case EventType.ExtractionDataContinue: {
        const users = [
          {
            id: 1,
            name: 'John',
            lastName: 'Phd',
          },
          {
            id: 2,
            name: 'Jane',
            lastName: 'Phd',
          },
        ];

        const { artifact, error } = await this.uploader.upload(
          'loopback_users_1.json',
          'users',
          users
        );

        if (error || !artifact) {
          await this.adapter.emit(ExtractorEventType.ExtractionDataError, {
            error,
          });
          return;
        }

        await this.adapter.emit(ExtractorEventType.ExtractionDataDone, {
          progress: 100,
          artifacts: [artifact],
        });

        break;
      }

      case EventType.ExtractionDataDelete: {
        await this.adapter.emit(ExtractorEventType.ExtractionDataDeleteDone);
        break;
      }

      case EventType.ExtractionAttachmentsStart: {
        const attachment1 = ['This is attachment1.txt content'];
        const { artifact, error } = await this.uploader.upload(
          'attachment1.txt',
          'attachment',
          attachment1
        );

        if (error || !artifact) {
          await this.adapter.emit(
            ExtractorEventType.ExtractionAttachmentsError,
            {
              error,
            }
          );
          return;
        }

        await this.adapter.emit(
          ExtractorEventType.ExtractionAttachmentsProgress,
          {
            artifacts: [artifact],
          }
        );

        break;
      }

      case EventType.ExtractionAttachmentsContinue: {
        const attachment2 = ['This is attachment2.txt content'];
        const { artifact, error } = await this.uploader.upload(
          'attachment2.txt',
          'attachment',
          attachment2
        );

        if (error || !artifact) {
          await this.adapter.emit(
            ExtractorEventType.ExtractionAttachmentsError,
            {
              error,
            }
          );
          return;
        }

        await this.adapter.emit(ExtractorEventType.ExtractionAttachmentsDone, {
          artifacts: [artifact],
        });

        break;
      }

      case EventType.ExtractionAttachmentsDelete: {
        await this.adapter.emit(
          ExtractorEventType.ExtractionAttachmentsDeleteDone
        );
        break;
      }

      default: {
        console.error(
          'Event in DemoExtractor run not recognized: ' +
            JSON.stringify(this.event.payload.event_type)
        );
      }
    }
  }
}
