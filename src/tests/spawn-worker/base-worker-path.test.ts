import { AirdropEvent, spawn } from '../../index';
import { EventType, ExtractorEventType } from '../../types/extraction';
import { createMockEvent } from '../../common/test-utils';
import { mockServer } from '../jest.setup';

jest.setTimeout(30000);

const runWithBaseWorkerPath = async (event: AirdropEvent) =>
  spawn<Record<string, unknown>>({
    event,
    initialState: {},
    initialDomainMapping: {},
    baseWorkerPath: __dirname,
    options: { isLocalDevelopment: true },
  });

describe('spawn() worker path resolution', () => {
  it.each([
    [EventType.StartExtractingMetadata],
    [EventType.ContinueExtractingMetadata],
  ])(
    'routes %s to the metadata extraction worker',
    async (eventType: EventType) => {
      // Arrange
      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: eventType },
      });

      // Act
      await runWithBaseWorkerPath(event);

      // Assert
      const lastRequest = mockServer.getLastRequest();
      expect(lastRequest?.url).toContain('/callback_url');
      expect((lastRequest?.body as { event_type: string }).event_type).toBe(
        ExtractorEventType.MetadataExtractionDone
      );
    }
  );
});
