import { EventType, ExtractorEventType } from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

describe('Dummy Connector - External Sync Units Extraction', () => {
  it('should successfully emit external sync units done event when all endpoints return 200', async () => {
    const event = createEvent({
      eventType: EventType.StartExtractingExternalSyncUnits,
    });

    await run([event], __dirname + '/external-sync-units-extraction');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.ExternalSyncUnitExtractionDone
    );
  });

  it('should upload external sync units as an artifact instead of sending them inline', async () => {
    const event = createEvent({
      eventType: EventType.StartExtractingExternalSyncUnits,
    });

    await run([event], __dirname + '/external-sync-units-extraction');

    // Verify artifact upload endpoints were called
    const uploadUrlRequests = mockServer.getRequestCount(
      'GET',
      '/internal/airdrop.artifacts.upload-url'
    );
    expect(uploadUrlRequests).toBeGreaterThanOrEqual(1);

    const fileUploadRequests = mockServer.getRequestCount(
      'POST',
      '/file-upload-url'
    );
    expect(fileUploadRequests).toBeGreaterThanOrEqual(1);

    const confirmUploadRequests = mockServer.getRequestCount(
      'POST',
      '/internal/airdrop.artifacts.confirm-upload'
    );
    expect(confirmUploadRequests).toBeGreaterThanOrEqual(1);

    // Verify the callback contains artifacts in event_data
    const callbackRequests = mockServer.getRequests('POST', '/callback_url');
    expect(callbackRequests.length).toBe(1);

    const callbackBody = callbackRequests[0].body as {
      event_type: string;
      event_data: {
        artifacts?: { id: string; item_type: string; item_count: number }[];
        external_sync_units?: unknown[];
      };
    };

    // Artifacts should be present with the external_sync_units item type
    expect(callbackBody.event_data.artifacts).toBeDefined();
    expect(callbackBody.event_data.artifacts!.length).toBeGreaterThanOrEqual(1);
    expect(
      callbackBody.event_data.artifacts!.some(
        (a) => a.item_type === 'external_sync_units'
      )
    ).toBe(true);

    // External sync units should NOT be sent inline in event_data
    expect(callbackBody.event_data.external_sync_units).toBeUndefined();
  });
});
