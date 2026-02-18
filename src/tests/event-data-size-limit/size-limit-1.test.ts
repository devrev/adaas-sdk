import {
  EventType,
  ExtractorEvent,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';
import run from './extraction';

// Increase timeout for this test since we're doing many uploads
jest.setTimeout(60000);

describe('size-limit-1: SQS size limit early exit', () => {
  it('should emit progress event when size limit is exceeded during data extraction', async () => {
    const event = createEvent({
      eventType: EventType.StartExtractingData,
    });

    await run([event], __dirname + '/size-limit-1');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');

    const body = lastRequest?.body as ExtractorEvent;

    expect(body.event_type).toBe(ExtractorEventType.DataExtractionProgress);

    // Verify that artifacts array is included and contains the expected number of artifacts
    expect(body.event_data?.artifacts).toBeDefined();
    expect(Array.isArray(body.event_data?.artifacts)).toBe(true);

    // All 3000 items should be uploaded (size limit triggers during upload but doesn't stop the current push)
    // The task's emit(Done) is blocked because isTimeout is true, and onTimeout emits Progress instead
    const artifactsCount = body.event_data?.artifacts?.length || 0;
    expect(artifactsCount).toBe(3000);

    // Verify that each artifact only contains metadata (id, item_type, item_count)
    // This is what gets included in the SQS message - NOT the actual file contents
    const firstArtifact = body.event_data?.artifacts?.[0];
    expect(firstArtifact).toHaveProperty('id');
    expect(firstArtifact).toHaveProperty('item_type');
    expect(firstArtifact).toHaveProperty('item_count');
    expect(Object.keys(firstArtifact || {}).length).toBe(3);

    // Verify the total size of all artifact metadata exceeds the 160KB threshold
    const totalArtifactsSize = Buffer.byteLength(
      JSON.stringify(body.event_data?.artifacts),
      'utf8'
    );
    expect(totalArtifactsSize).toBeGreaterThan(160000); // 160KB threshold
  });
});
