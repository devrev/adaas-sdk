import { AirdropEvent, EventType } from '../../../types/extraction';
import { createEvent } from '../../test-helpers';

import run from './extraction';

describe('Dummy Connector - External Sync Units Extraction', () => {
  let event: AirdropEvent;

  beforeEach(() => {
    event = createEvent({
      eventType: EventType.ExtractionExternalSyncUnitsStart,
    });
  });

  it('should emit external sync units done event', async () => {
    await run([event], __dirname + '/external-sync-units-extraction');
  });
});
