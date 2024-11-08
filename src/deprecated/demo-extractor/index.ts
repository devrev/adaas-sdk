import {
  AirdropEvent,
  EventType,
  ExternalSyncUnit,
  ExtractorEventType,
} from '../../types/extraction';
import { Adapter } from '../adapter';
import { Uploader } from '../uploader';
import externalDomainMetadata from './external_domain_metadata.json';

type ConnectorState = object;

/**
 * Demo extractor is a reference implementation of an ADaaS connector to facilitate rapid immersion into ADaaS.
 *
 * @class DemoExtractor
 * @deprecated
 **/
export class DemoExtractor {
  private event: AirdropEvent;
  private adapter: Adapter<ConnectorState>;
  private uploader: Uploader;

  constructor(event: AirdropEvent, adapter: Adapter<ConnectorState>) {
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
        const { artifact, error } = await this.uploader.upload(
          'metadata_1.jsonl',
          'external_domain_metadata',
          externalDomainMetadata
        );

        if (error || !artifact) {
          await this.adapter.emit(ExtractorEventType.ExtractionMetadataError, {
            error,
          });
          return;
        }

        await this.adapter.emit(ExtractorEventType.ExtractionMetadataDone, {
          artifacts: [artifact],
        });

        break;
      }

      case EventType.ExtractionDataStart: {
        const contacts = [
          {
            id: 'contact-1',
            created_date: '1999-12-25T01:00:03+01:00',
            modified_date: '1999-12-25T01:00:03+01:00',
            data: {
              email: 'johnsmith@test.com',
              name: 'John Smith',
            },
          },
          {
            id: 'contact-2',
            created_date: '1999-12-27T15:31:34+01:00',
            modified_date: '2002-04-09T01:55:31+02:00',
            data: {
              email: 'janesmith@test.com',
              name: 'Jane Smith',
            },
          },
        ];

        const { artifact, error } = await this.uploader.upload(
          'contacts_1.json',
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
            id: 'user-1',
            created_date: '1999-12-25T01:00:03+01:00',
            modified_date: '1999-12-25T01:00:03+01:00',
            data: {
              email: 'johndoe@test.com',
              name: 'John Doe',
            },
          },
          {
            id: 'user-2',
            created_date: '1999-12-27T15:31:34+01:00',
            modified_date: '2002-04-09T01:55:31+02:00',
            data: {
              email: 'janedoe@test.com',
              name: 'Jane Doe',
            },
          },
        ];

        const { artifact, error } = await this.uploader.upload(
          'users_1.json',
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
