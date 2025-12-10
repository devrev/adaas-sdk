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
});
