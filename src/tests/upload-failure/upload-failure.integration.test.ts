import {
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { mockServer } from './mock-server.setup';
import { createMockEvent } from '../../common/test-utils';
import {
  expectLastCallbackError,
  expectNoCallbackWithEventType,
  getCallbackEventBodies,
} from '../test-helpers';

import run from './extraction';

const UPLOAD_URL_PATH = '/internal/airdrop.artifacts.upload-url';
const UPLOAD_URL_ERROR_SNIPPET = 'artifact upload URL';

function failUploadUrlRoute(status: number): void {
  mockServer.setRoute({
    path: UPLOAD_URL_PATH,
    method: 'GET',
    status,
  });
}

describe('Upload failure integration (fast)', () => {
  beforeEach(() => {
    mockServer.resetRoutes();
  });

  describe('repo.push batch upload failure', () => {
    it('should emit DataExtractionError when upload-url returns 400 during push', async () => {
      failUploadUrlRoute(400);

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
        UPLOAD_URL_ERROR_SNIPPET
      );
      expect(
        mockServer.getRequestCount('GET', UPLOAD_URL_PATH)
      ).toBeGreaterThanOrEqual(1);
      expect(
        callbacks[callbacks.length - 1].event_data?.error?.message
      ).toContain('Error while processing task');
    });

    it('should emit DataExtractionError when presigned file upload returns 400 during push', async () => {
      mockServer.setRoute({
        path: '/file-upload-url',
        method: 'POST',
        status: 400,
      });

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
        'uploading artifact'
      );
      expect(
        mockServer.getRequestCount('GET', UPLOAD_URL_PATH)
      ).toBeGreaterThanOrEqual(1);
      expect(mockServer.getRequestCount('POST', '/file-upload-url')).toBe(1);
      expect(
        callbacks[callbacks.length - 1].event_data?.error?.message
      ).toContain('Error while processing task');
    });
  });

  describe('uploadAllRepos failure at emit', () => {
    it('should emit DataExtractionError when upload-url returns 400 during emit flush', async () => {
      failUploadUrlRoute(400);

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
        UPLOAD_URL_ERROR_SNIPPET
      );
      expect(
        callbacks[callbacks.length - 1].event_data?.error?.message
      ).not.toContain('Worker exited without emitting');
    });

    it('should emit error when presigned file upload returns 400', async () => {
      mockServer.setRoute({
        path: '/file-upload-url',
        method: 'POST',
        status: 400,
      });

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
        'uploading artifact'
      );
    });

    it('should emit error when confirm-upload returns 400', async () => {
      mockServer.setRoute({
        path: '/internal/airdrop.artifacts.confirm-upload',
        method: 'POST',
        status: 400,
      });

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
        'confirming artifact upload'
      );
    });
  });

  describe('partial upload then uploadAllRepos failure', () => {
    it('should include one artifact when first batch succeeds and remainder upload fails', async () => {
      mockServer.setRoute({
        path: UPLOAD_URL_PATH,
        method: 'GET',
        status: 200,
        succeedThenFail: {
          successCount: 1,
          errorStatus: 400,
        },
      });

      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: EventType.StartExtractingData },
      });

      await run([event], __dirname + '/emit-partial-failure');

      const callbacks = getCallbackEventBodies(mockServer.getCallbackRequests());
      expectNoCallbackWithEventType(
        callbacks,
        ExtractorEventType.DataExtractionDone
      );
      expectLastCallbackError(
        callbacks,
        ExtractorEventType.DataExtractionError,
        UPLOAD_URL_ERROR_SNIPPET
      );
      expect(callbacks[callbacks.length - 1].event_data?.artifacts).toHaveLength(
        1
      );
      expect(
        callbacks[callbacks.length - 1].event_data?.artifacts?.[0].item_count
      ).toBe(10);
    });
  });

  describe('metadata extraction phase', () => {
    it('should emit MetadataExtractionError when upload-url returns 400', async () => {
      failUploadUrlRoute(400);

      const event = createMockEvent(mockServer.baseUrl, {
        payload: { event_type: EventType.StartExtractingMetadata },
      });

      await run([event], __dirname + '/metadata-upload-failure');

      const callbacks = getCallbackEventBodies(mockServer.getCallbackRequests());
      expectNoCallbackWithEventType(
        callbacks,
        ExtractorEventType.MetadataExtractionDone
      );
      expectLastCallbackError(
        callbacks,
        ExtractorEventType.MetadataExtractionError,
        UPLOAD_URL_ERROR_SNIPPET
      );
    });
  });
});
