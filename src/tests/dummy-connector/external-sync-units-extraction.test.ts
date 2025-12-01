import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { createEvent } from '../test-helpers';
import run from '../timeout-handling/extraction';
import { mockServer } from '../timeout-handling/jest.setup';

describe('Dummy Connector - External Sync Units Extraction', () => {
  let event: AirdropEvent;
  beforeEach(() => {
    event = createEvent({
      eventType: EventType.ExtractionExternalSyncUnitsStart,
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
