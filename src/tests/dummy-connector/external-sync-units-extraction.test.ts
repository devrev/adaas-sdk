import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

describe('Dummy Connector - External Sync Units Extraction', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.StartExtractingExternalSyncUnits,
    });
    // Configure the callback URL to return success
    mockServer.setRoute({
      path: '/callback_url',
      method: 'POST',
      status: 200,
      body: { success: true },
    });
  });

  it('should successfully emit external sync units done event when all endpoints return 200', async () => {
    await run([event], __dirname + '/external-sync-units-extraction');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as { event_type: string }).event_type).toBe(
      ExtractorEventType.ExternalSyncUnitExtractionDone
    );
  });
});
