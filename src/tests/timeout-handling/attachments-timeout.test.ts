import zlib from 'zlib';
import { jsonl } from 'js-jsonl';

import {
  AirdropEvent,
  EventType,
  ExtractorEvent,
  ExtractorEventType,
} from '../../types/extraction';
import { NormalizedAttachment } from '../../repo/repo.interfaces';
import { mockServer } from '../jest.setup';
import { createMockEvent } from '../../common/test-utils';

import run from './attachments-extraction';

// Worker has a 4s soft / ~5.2s hard timeout. Allow generous headroom so the
// test itself never times out before the worker resolves either way.
jest.setTimeout(30000);

const METADATA_ARTIFACT_ID = 'metadata-artifact-1';
const METADATA_DOWNLOAD_PATH = '/download/metadata-artifact-1';

function buildAttachments(
  count: number,
  hangId?: string
): NormalizedAttachment[] {
  const attachments: NormalizedAttachment[] = [];
  for (let i = 0; i < count; i++) {
    attachments.push({
      url: `https://example.com/file-${i}.txt`,
      id: `att-${i}`,
      file_name: `file-${i}.txt`,
      parent_id: `parent-${i}`,
    });
  }
  if (hangId) {
    // Land the hung attachment in the first concurrent batch (batchSize 10).
    attachments[9] = {
      url: 'https://example.com/hang.txt',
      id: hangId,
      file_name: 'hang.txt',
      parent_id: 'parent-hang',
    };
  }
  return attachments;
}

function seedAttachmentsState(
  baseUrl: string,
  attachments: NormalizedAttachment[]
): void {
  const state = {
    lastSyncStarted: '',
    lastSuccessfulSyncStarted: '',
    pendingWorkersOldest: '',
    pendingWorkersNewest: '',
    workersOldest: '',
    workersNewest: '',
    snapInVersionId: 'test_snap_in_version_id',
    toDevRev: {
      attachmentsMetadata: {
        artifactIds: [METADATA_ARTIFACT_ID],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    },
  };

  mockServer.setRoute({
    path: '/worker_data_url.get',
    method: 'GET',
    status: 200,
    body: { state: JSON.stringify(state) },
  });

  mockServer.setRoute({
    path: '/internal/airdrop.artifacts.download-url',
    method: 'GET',
    status: 200,
    body: { download_url: `${baseUrl}${METADATA_DOWNLOAD_PATH}` },
  });

  // The metadata artifact is downloaded as an arraybuffer of gzipped JSONL.
  const gzipped = zlib.gzipSync(jsonl.stringify(attachments));
  mockServer.setRoute({
    path: METADATA_DOWNLOAD_PATH,
    method: 'GET',
    status: 200,
    bodyBuffer: gzipped,
  });
}

describe('Attachments streaming soft timeout', () => {
  let event: AirdropEvent;

  beforeEach(() => {
    event = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingAttachments },
    });
  });

  it('emits PROGRESS (not hard-timeout ERROR) when a stream() call hangs past the soft timeout (logs2)', async () => {
    const attachments = buildAttachments(30, 'att-hangs');
    seedAttachmentsState(mockServer.baseUrl, attachments);

    await run([event], __dirname + '/attachments-timeout-hung-stream');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as ExtractorEvent).event_type).toBe(
      ExtractorEventType.AttachmentExtractionProgress
    );
  });

  it('emits PROGRESS (not hard-timeout ERROR) when artifact uploads 5xx into a retry storm past the soft timeout (logs1)', async () => {
    const attachments = buildAttachments(30);
    seedAttachmentsState(mockServer.baseUrl, attachments);

    // Upload always 500s -> axios-retry backoff keeps a worker stuck mid-retry.
    mockServer.setRoute({
      path: '/file-upload-url',
      method: 'POST',
      status: 500,
    });

    await run([event], __dirname + '/attachments-timeout-retry-storm');

    const lastRequest = mockServer.getLastRequest();
    expect(lastRequest?.url).toContain('/callback_url');
    expect(lastRequest?.method).toBe('POST');
    expect((lastRequest?.body as ExtractorEvent).event_type).toBe(
      ExtractorEventType.AttachmentExtractionProgress
    );
  });
});
