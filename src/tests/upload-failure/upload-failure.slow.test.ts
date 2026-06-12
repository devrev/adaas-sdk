/**
 * Upload-failure retry tests (spawn integration).
 *
 * Uses a dedicated mock server (./mock-server.setup) for isolation when the slow
 * project runs test files in parallel. These tests use the production retry
 * count and are intentionally slower than the fast upload-failure suite.
 */
import { EventType, ExtractorEventType } from '../../types/extraction';
import { createMockEvent } from '../../common/test-utils';
import {
  expectLastCallbackError,
  expectNoCallbackWithEventType,
  getCallbackEventBodies,
} from '../test-helpers';
import { mockServer } from './mock-server.setup';

import run from './extraction';

jest.setTimeout(180000);

const UPLOAD_URL_PATH = '/internal/airdrop.artifacts.upload-url';
const TEST_HTTP_RETRIES = 5;

function failUploadUrlPermanently(): void {
  mockServer.setRoute({
    path: UPLOAD_URL_PATH,
    method: 'GET',
    status: 503,
  });
}

describe('Upload failure integration (retry exhaustion)', () => {
  it('should emit DataExtractionError after upload-url retries are exhausted during push', async () => {
    failUploadUrlPermanently();

    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingData },
    });

    await run([event], __dirname + '/push-batch-failure');

    const callbacks = getCallbackEventBodies(mockServer.getCallbackRequests());
    expectNoCallbackWithEventType(
      callbacks,
      ExtractorEventType.DataExtractionDone
    );
    expectLastCallbackError(
      callbacks,
      ExtractorEventType.DataExtractionError,
      'artifact upload URL'
    );
    expect(mockServer.getRequestCount('GET', UPLOAD_URL_PATH)).toBe(
      TEST_HTTP_RETRIES + 1
    );
  });

  it('should emit DataExtractionError after upload-url retries are exhausted during emit flush', async () => {
    failUploadUrlPermanently();

    const event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingData },
    });

    await run([event], __dirname + '/emit-remainder-failure');

    const callbacks = getCallbackEventBodies(mockServer.getCallbackRequests());
    expectNoCallbackWithEventType(
      callbacks,
      ExtractorEventType.DataExtractionDone
    );
    expectLastCallbackError(
      callbacks,
      ExtractorEventType.DataExtractionError,
      'artifact upload URL'
    );
    expect(
      callbacks[callbacks.length - 1].event_data?.error?.message
    ).not.toContain('Worker exited without emitting');
    expect(mockServer.getRequestCount('GET', UPLOAD_URL_PATH)).toBe(
      TEST_HTTP_RETRIES + 1
    );
  });
});
