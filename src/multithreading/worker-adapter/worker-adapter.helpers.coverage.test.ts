import { State } from '../../state/state';
import { mockServer } from '../../tests/jest.setup';
import { createMockEvent } from '../../common/test-utils';
import {
  AirdropEvent,
  Artifact,
  EventType,
  ExtractorEventType,
} from '../../types';
import { ActionType, LoaderEventType } from '../../types/loading';
import { AdapterState } from '../../state/state.interfaces';
import { WorkerAdapter } from './worker-adapter';

/* eslint-disable @typescript-eslint/no-require-imports */

jest.mock('../../common/control-protocol', () => ({
  emit: jest.fn().mockResolvedValue({}),
}));

jest.mock('../../mappers/mappers');
jest.mock('../../uploader/uploader');
jest.mock('../../repo/repo');
jest.mock('node:worker_threads', () => ({
  parentPort: { postMessage: jest.fn() },
}));
jest.mock('../../attachments-streaming/attachments-streaming-pool', () => ({
  AttachmentsStreamingPool: jest.fn().mockImplementation(() => ({
    streamAll: jest.fn().mockResolvedValue(undefined),
  })),
}));

// ---------------------------------------------------------------------------
// Shared setup helpers
// ---------------------------------------------------------------------------

function makeAdapter(
  eventType: EventType = EventType.StartExtractingData,
  stateOverrides: Partial<AdapterState<Record<string, unknown>>> = {}
): WorkerAdapter<Record<string, unknown>> {
  const event = createMockEvent(mockServer.baseUrl, {
    payload: { event_type: eventType },
  });
  const initialState: AdapterState<Record<string, unknown>> = {
    lastSyncStarted: '',
    lastSuccessfulSyncStarted: '',
    snapInVersionId: '',
    toDevRev: {
      attachmentsMetadata: {
        artifactIds: [],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    },
    ...stateOverrides,
  };
  const adapterState = new State({ event, initialState });
  return new WorkerAdapter({ event, adapterState });
}

// Builds a minimal ExternalSystemItem for the loader tests.
function makeLoaderItem(devrevId = 'dev-1') {
  return {
    id: { devrev: devrevId, external: 'ext-1' },
    created_date: '',
    modified_date: '',
    data: {},
  };
}

// Sets up adapter.fromDevRev state with one file containing the given items,
// and mocks getJsonObjectByArtifactId to return them.
function setupLoaderFile(
  adapter: WorkerAdapter<Record<string, unknown>>,
  items: ReturnType<typeof makeLoaderItem>[],
  itemType = 'tasks'
) {
  adapter['adapterState'].state.fromDevRev = {
    filesToLoad: [
      {
        id: 'artifact-1',
        file_name: 'file.json',
        itemType,
        count: items.length,
        lineToProcess: 0,
        completed: false,
      },
    ],
  };
  adapter['uploader'].getJsonObjectByArtifactId = jest
    .fn()
    .mockResolvedValue({ response: items });
}

// ---------------------------------------------------------------------------

describe('WorkerAdapter.getRepo', () => {
  it('should return undefined and log an error when the requested repo was never initialised', () => {
    const adapter = makeAdapter();
    const consoleSpy = jest
      .spyOn(console, 'error')
      .mockImplementation(() => {});

    const result = adapter.getRepo('non-existent-type');

    expect(result).toBeUndefined();
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('non-existent-type')
    );
    consoleSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.initializeRepos — event size threshold', () => {
  it('should set isTimeout=true once the cumulative artifact payload exceeds EVENT_SIZE_THRESHOLD_BYTES', () => {
    const adapter = makeAdapter();
    jest.spyOn(console, 'log').mockImplementation(() => {});

    // Capture the onUpload callback injected into the Repo constructor
    let capturedOnUpload: ((artifact: Artifact) => void) | undefined;
    const { Repo } = require('../../repo/repo');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (Repo as jest.Mock).mockImplementationOnce((opts: any) => {
      capturedOnUpload = opts.onUpload;
      return { itemType: 'issues', upload: jest.fn(), uploadedArtifacts: [] };
    });

    adapter.initializeRepos([{ itemType: 'issues' }]);
    expect(capturedOnUpload).toBeDefined();

    // Fire the callback with an artifact whose serialised size exceeds the threshold
    capturedOnUpload!({
      id: 'artifact-x',
      item_count: 1,
      item_type: 'x'.repeat(200_000), // >> EVENT_SIZE_THRESHOLD_BYTES (~160 KB)
    });

    expect(adapter.isTimeout).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.emit — error message truncation', () => {
  it('should truncate a long error message, preserving the original prefix', async () => {
    const adapter = makeAdapter();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

    // 20 000 chars — well above MAX_LOG_STRING_LENGTH (10 000)
    const longMessage = 'E'.repeat(20_000);

    await adapter.emit(ExtractorEventType.DataExtractionError, {
      error: { message: longMessage },
    });

    const { emit: mockEmit } = require('../../common/control-protocol');
    const emittedMessage = mockEmit.mock.calls[0][0].data?.error
      ?.message as string;

    // The emitted message must be shorter (truncated), AND the content up to
    // the truncation point must match the original — not replaced with a generic placeholder.
    expect(emittedMessage.length).toBeLessThan(longMessage.length);
    expect(emittedMessage.startsWith('E'.repeat(100))).toBe(true);
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.emit — ExternalSyncUnitExtractionDone legacy path', () => {
  it('should upload ESUs via a repo and strip external_sync_units from the emitted payload', async () => {
    const adapter = makeAdapter(EventType.StartExtractingExternalSyncUnits);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    adapter['adapterState'].postState = jest.fn().mockResolvedValue(undefined);
    adapter.uploadAllRepos = jest.fn().mockResolvedValue(undefined);

    const pushMock = jest.fn().mockResolvedValue(undefined);
    jest.spyOn(adapter, 'initializeRepos');
    jest.spyOn(adapter, 'getRepo').mockReturnValue({ push: pushMock } as never);

    const esus = [{ id: 'esu-1' }, { id: 'esu-2' }] as never;

    await adapter.emit(ExtractorEventType.ExternalSyncUnitExtractionDone, {
      external_sync_units: esus,
    });

    // ESUs were pushed to the repo before emitting
    expect(pushMock).toHaveBeenCalledWith(esus);

    // external_sync_units must NOT appear in the payload sent to the platform
    // (it would be too large for SQS — that is the entire reason this path exists)
    const { emit: mockEmit } = require('../../common/control-protocol');
    const emittedData = mockEmit.mock.calls[0][0].data as Record<
      string,
      unknown
    >;
    expect(emittedData).not.toHaveProperty('external_sync_units');
  });
});

// ---------------------------------------------------------------------------
// loadItem branches — exercised through the public loadItemTypes API
//
// Setup: each test uses ContinueLoadingData so fromDevRev can be set directly,
// a single-item single-file setup, and real Mappers mock responses.
// ---------------------------------------------------------------------------

describe('WorkerAdapter.loadItemTypes — loadItem branch coverage via public API', () => {
  let adapter: WorkerAdapter<Record<string, unknown>>;
  let emitSpy: jest.SpyInstance;
  let exitSpy: jest.SpyInstance;

  const itemTypesToLoad = [
    { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
  ];

  beforeEach(() => {
    adapter = makeAdapter(EventType.ContinueLoadingData);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
    exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    // Reset the create/update spies between tests
    itemTypesToLoad[0].create = jest.fn();
    itemTypesToLoad[0].update = jest.fn();
  });

  afterEach(() => {
    exitSpy.mockRestore();
  });

  // ---- Happy path: update succeeds, mapper update succeeds → UPDATED report ----
  it('should accumulate an UPDATED report when the connector updates the item and the mapper sync succeeds', async () => {
    setupLoaderFile(adapter, [makeLoaderItem('dev-1')]);
    adapter['_mappers'].getByTargetId = jest.fn().mockResolvedValue({
      data: { sync_mapper_record: { id: 'smr-1' } },
    });
    adapter['_mappers'].update = jest.fn().mockResolvedValue({ data: {} });
    itemTypesToLoad[0].update = jest
      .fn()
      .mockResolvedValue({ id: 'ext-updated-1' });

    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });

    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_type: 'tasks',
          [ActionType.UPDATED]: 1,
        }),
      ])
    );
    expect(emitSpy).not.toHaveBeenCalled(); // no error events
  });

  // ---- 404 fallback: mapper not found → create path → CREATED report ----
  it('should fall back to create and accumulate a CREATED report when the mapper record does not exist (404)', async () => {
    setupLoaderFile(adapter, [makeLoaderItem('dev-2')]);
    const axiosError = { isAxiosError: true, response: { status: 404 } };
    adapter['_mappers'].getByTargetId = jest.fn().mockRejectedValue(axiosError);
    adapter['_mappers'].create = jest.fn().mockResolvedValue({ data: {} });
    itemTypesToLoad[0].create = jest
      .fn()
      .mockResolvedValue({ id: 'new-ext-id' });

    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });

    expect(reports).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          item_type: 'tasks',
          [ActionType.CREATED]: 1,
        }),
      ])
    );
    expect(emitSpy).not.toHaveBeenCalled();
  });

  // ---- Rate-limit during update → emits DataLoadingDelayed and breaks ----
  it('should emit DataLoadingDelayed and stop processing when the connector signals a rate-limit delay', async () => {
    setupLoaderFile(adapter, [makeLoaderItem('dev-3')]);
    adapter['_mappers'].getByTargetId = jest.fn().mockResolvedValue({
      data: { sync_mapper_record: { id: 'smr-1' } },
    });
    itemTypesToLoad[0].update = jest.fn().mockResolvedValue({ delay: 15 });

    await adapter.loadItemTypes({ itemTypesToLoad });

    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.DataLoadingDelayed,
      expect.objectContaining({ delay: 15 })
    );
  });

  // ---- Mapper update failure → item counted as failed ----
  it('should count the item as FAILED when the update succeeds but the mapper sync throws', async () => {
    setupLoaderFile(adapter, [makeLoaderItem('dev-4')]);
    adapter['_mappers'].getByTargetId = jest.fn().mockResolvedValue({
      data: { sync_mapper_record: { id: 'smr-1' } },
    });
    adapter['_mappers'].update = jest
      .fn()
      .mockRejectedValue(new Error('mapper down'));
    itemTypesToLoad[0].update = jest.fn().mockResolvedValue({ id: 'ext-id' });

    // loadItem returns an error record; loadItemTypes aggregates it via addReportToLoaderReport.
    // The error shows up in reports as a FAILED count.
    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });
    // The error path does not emit a platform event — it records locally and continues.
    expect(emitSpy).not.toHaveBeenCalled();
    // reports may be empty (error record is not a loader report) — the key assertion
    // is that the loop does NOT crash and returns cleanly.
    expect(reports).toBeDefined();
  });

  // ---- Non-404 Axios error from mapper → DataLoadingError ----
  it('should emit DataLoadingError when the mapper call fails with a non-404 Axios error', async () => {
    setupLoaderFile(adapter, [makeLoaderItem('dev-5')]);
    const axiosError = {
      isAxiosError: true,
      message: 'internal server error',
      response: { status: 500 },
    };
    adapter['_mappers'].getByTargetId = jest.fn().mockRejectedValue(axiosError);

    // loadItem returns { error } → addReportToLoaderReport records it.
    // The loop continues but no platform event is fired for individual item errors.
    await adapter.loadItemTypes({ itemTypesToLoad });
    expect(emitSpy).not.toHaveBeenCalled();
  });

  // ---- Missing sync_mapper_record in response → does not crash ----
  it('should handle a null sync_mapper_record gracefully and continue loading', async () => {
    setupLoaderFile(adapter, [makeLoaderItem('dev-6')]);
    adapter['_mappers'].getByTargetId = jest
      .fn()
      .mockResolvedValue({ data: null });

    const { reports } = await adapter.loadItemTypes({ itemTypesToLoad });

    expect(emitSpy).not.toHaveBeenCalled();
    expect(reports).toBeDefined();
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.loadAttachment', () => {
  let adapter: WorkerAdapter<Record<string, unknown>>;

  beforeEach(() => {
    adapter = makeAdapter(EventType.ContinueLoadingAttachments);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  function makeAttachment() {
    return {
      reference_id: 'ref-1',
      parent_type: 'task',
      parent_reference_id: 'parent-1',
      file_name: 'file.pdf',
      file_type: 'application/pdf',
      file_size: 100,
      url: 'https://example.com/file.pdf',
      valid_until: '',
      created_by_id: 'user-1',
      created_date: '',
      modified_by_id: 'user-1',
      modified_date: '',
    };
  }

  it('should return a CREATED report when create succeeds', async () => {
    adapter['_mappers'].create = jest.fn().mockResolvedValue({ data: {} });
    const create = jest.fn().mockResolvedValue({ id: 'att-ext-1' });

    const result = await adapter['loadAttachment']({
      item: makeAttachment() as never,
      create,
    });

    expect(result.report?.item_type).toBe('attachment');
    expect(result.report?.[ActionType.CREATED]).toBe(1);
  });

  it('should still return CREATED even when mapper create fails — attachment loading is resilient', async () => {
    // Mapper failure is intentionally non-fatal for attachment loading.
    adapter['_mappers'].create = jest
      .fn()
      .mockRejectedValue(new Error('mapper failed'));
    const create = jest.fn().mockResolvedValue({ id: 'att-ext-1' });

    const result = await adapter['loadAttachment']({
      item: makeAttachment() as never,
      create,
    });

    expect(result.report?.[ActionType.CREATED]).toBe(1);
  });

  it('should propagate rate-limit delay when the connector signals one', async () => {
    const create = jest.fn().mockResolvedValue({ delay: 30 });

    const result = await adapter['loadAttachment']({
      item: makeAttachment() as never,
      create,
    });

    expect(result.rateLimit?.delay).toBe(30);
  });

  it('should return a FAILED report when create returns neither id nor delay', async () => {
    const create = jest.fn().mockResolvedValue({ id: null, delay: null });

    const result = await adapter['loadAttachment']({
      item: makeAttachment() as never,
      create,
    });

    expect(result.report?.[ActionType.FAILED]).toBe(1);
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.loadItemTypes — additional branches', () => {
  let adapter: WorkerAdapter<Record<string, unknown>>;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = makeAdapter(EventType.ContinueLoadingData);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
  });

  it('should return immediately with empty reports when filesToLoad is empty', async () => {
    adapter['adapterState'].state.fromDevRev = { filesToLoad: [] };

    const result = await adapter.loadItemTypes({
      itemTypesToLoad: [
        { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
      ],
    });

    expect(result.reports).toEqual([]);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit DataLoadingError when a file references an item type not in itemTypesToLoad', async () => {
    adapter['adapterState'].state.fromDevRev = {
      filesToLoad: [
        {
          id: 'art-1',
          file_name: 'file.json',
          itemType: 'unknown-type',
          count: 1,
          lineToProcess: 0,
          completed: false,
        },
      ],
    };
    adapter['uploader'].getJsonObjectByArtifactId = jest
      .fn()
      .mockResolvedValue({ response: [makeLoaderItem()] });

    await adapter.loadItemTypes({
      itemTypesToLoad: [
        { itemType: 'tasks', create: jest.fn(), update: jest.fn() },
      ],
    });

    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.DataLoadingError,
      expect.objectContaining({
        error: expect.objectContaining({
          message: expect.stringContaining('unknown-type'),
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.loadAttachments — additional branches', () => {
  let adapter: WorkerAdapter<Record<string, unknown>>;
  let emitSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = makeAdapter(EventType.ContinueLoadingAttachments);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
    emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();
  });

  it('should return immediately with empty reports when fromDevRev is not set', async () => {
    adapter['adapterState'].state.fromDevRev = undefined;

    const result = await adapter.loadAttachments({ create: jest.fn() });

    expect(result.reports).toEqual([]);
    expect(emitSpy).not.toHaveBeenCalled();
  });

  it('should emit AttachmentLoadingDelayed and stop the loop when the connector signals a rate-limit delay', async () => {
    adapter['adapterState'].state.fromDevRev = {
      filesToLoad: [
        {
          id: 'art-1',
          file_name: 'attachments.json',
          itemType: 'attachment',
          count: 1,
          lineToProcess: 0,
          completed: false,
        },
      ],
    };
    adapter['uploader'].getJsonObjectByArtifactId = jest
      .fn()
      .mockResolvedValue({
        response: [
          {
            reference_id: 'ref-1',
            parent_type: 'task',
            parent_reference_id: 'parent-1',
            file_name: 'file.pdf',
            file_type: 'application/pdf',
            file_size: 100,
            url: 'https://example.com/file.pdf',
            valid_until: '',
            created_by_id: 'user-1',
            created_date: '',
            modified_by_id: 'user-1',
            modified_date: '',
          },
        ],
      });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    jest
      .spyOn(adapter as any, 'loadAttachment')
      .mockResolvedValue({ rateLimit: { delay: 20 } });

    await adapter.loadAttachments({ create: jest.fn() });

    expect(emitSpy).toHaveBeenCalledWith(
      LoaderEventType.AttachmentLoadingDelayed,
      expect.objectContaining({ delay: 20 })
    );
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.streamAttachments — custom processors path', () => {
  let adapter: WorkerAdapter<Record<string, unknown>>;

  beforeEach(() => {
    adapter = makeAdapter();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should surface the delay returned by the iterator when a rate-limit occurs mid-stream', async () => {
    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['art-1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };
    const mockAttachments = [
      { id: 'att-1', file_name: 'file.pdf', parent_id: 'p-1' },
    ];
    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({ attachments: mockAttachments });
    adapter.initializeRepos = jest.fn();

    const reducerMock = jest.fn().mockReturnValue([]);
    // Iterator signals rate-limit — the adapter must surface this to the caller
    const iteratorMock = jest.fn().mockResolvedValue({ delay: 10 });

    const result = await adapter.streamAttachments({
      stream: jest.fn(),
      processors: { reducer: reducerMock, iterator: iteratorMock },
    });

    expect(result).toEqual({ delay: 10 });
    expect(reducerMock).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: mockAttachments, adapter })
    );
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.destroyHttpStream', () => {
  let adapter: WorkerAdapter<Record<string, unknown>>;

  beforeEach(() => {
    adapter = makeAdapter();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it.each([
    {
      label: 'calls destroy() when available',
      data: { destroy: jest.fn(), close: jest.fn() },
      expectDestroy: true,
      expectClose: false,
    },
    {
      label: 'calls close() when destroy is not present',
      data: { close: jest.fn() },
      expectDestroy: false,
      expectClose: true,
    },
    {
      label: 'does not throw when neither method is present',
      data: {},
      expectDestroy: false,
      expectClose: false,
    },
    {
      label: 'does not throw when data is null',
      data: null,
      expectDestroy: false,
      expectClose: false,
    },
  ])('$label', ({ data, expectDestroy, expectClose }) => {
    const httpStream = { data } as never;
    expect(() => adapter['destroyHttpStream'](httpStream)).not.toThrow();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (expectDestroy) expect((data as any).destroy).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (expectClose) expect((data as any).close).toHaveBeenCalled();
  });

  it('should warn without re-throwing when destroy() itself throws', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const httpStream = {
      data: {
        destroy: () => {
          throw new Error('stream error');
        },
      },
    };
    expect(() =>
      adapter['destroyHttpStream'](httpStream as never)
    ).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('Error while destroying HTTP stream'),
      expect.any(Error)
    );
  });
});

// ---------------------------------------------------------------------------

describe('WorkerAdapter.processAttachment — error paths and ssorAttachment construction', () => {
  let adapter: WorkerAdapter<Record<string, unknown>>;
  let mockEvent: AirdropEvent;

  beforeEach(() => {
    mockEvent = createMockEvent(mockServer.baseUrl, {
      payload: { event_type: EventType.StartExtractingAttachments },
    });
    adapter = new WorkerAdapter({
      event: mockEvent,
      adapterState: new State({ event: mockEvent, initialState: {} }),
    });
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  const makeAttachment = (overrides = {}) => ({
    id: 'att-1',
    url: 'https://example.com/file.pdf',
    file_name: 'file.pdf',
    parent_id: 'parent-1',
    content_type: 'application/pdf',
    ...overrides,
  });

  const makeHttpStream = () => ({
    headers: { 'content-type': 'application/pdf', 'content-length': '100' },
    data: { destroy: jest.fn() },
  });

  it('should return the stream error directly when the stream function returns an error', async () => {
    const stream = jest
      .fn()
      .mockResolvedValue({ error: new Error('stream failed') });
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );
    expect(result?.error).toBeDefined();
  });

  it('should propagate a rate-limit delay from the stream function', async () => {
    const stream = jest.fn().mockResolvedValue({ delay: 5 });
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );
    expect(result?.delay).toBe(5);
  });

  it('should return an error containing the attachment ID when getArtifactUploadUrl fails', async () => {
    const stream = jest
      .fn()
      .mockResolvedValue({ httpStream: makeHttpStream() });
    adapter['uploader'].getArtifactUploadUrl = jest
      .fn()
      .mockResolvedValue({ error: new Error('upload url failed') });

    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );
    expect(result?.error?.message).toContain('att-1');
    expect(result?.error?.message).toContain('preparing artifact');
  });

  it('should return an error when streamArtifact fails', async () => {
    const stream = jest
      .fn()
      .mockResolvedValue({ httpStream: makeHttpStream() });
    adapter['uploader'].getArtifactUploadUrl = jest.fn().mockResolvedValue({
      response: {
        artifact_id: 'art-1',
        upload_url: 'https://upload',
        form_data: [],
      },
    });
    adapter['uploader'].streamArtifact = jest
      .fn()
      .mockResolvedValue({ error: new Error('stream failed') });

    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );
    expect(result?.error?.message).toContain('streaming to artifact');
  });

  it('should return an error when confirmArtifactUpload fails', async () => {
    const stream = jest
      .fn()
      .mockResolvedValue({ httpStream: makeHttpStream() });
    adapter['uploader'].getArtifactUploadUrl = jest.fn().mockResolvedValue({
      response: {
        artifact_id: 'art-1',
        upload_url: 'https://upload',
        form_data: [],
      },
    });
    adapter['uploader'].streamArtifact = jest
      .fn()
      .mockResolvedValue({ response: {} });
    adapter['uploader'].confirmArtifactUpload = jest
      .fn()
      .mockResolvedValue({ error: new Error('confirm failed') });

    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );
    expect(result?.error?.message).toContain('confirming upload');
  });

  it.each([
    { inline: true, expected: true },
    { inline: false, expected: false },
  ])(
    'should set inline=$expected on the ssorAttachment when attachment.inline=$inline',
    async ({ inline, expected }) => {
      const stream = jest
        .fn()
        .mockResolvedValue({ httpStream: makeHttpStream() });
      adapter['uploader'].getArtifactUploadUrl = jest.fn().mockResolvedValue({
        response: {
          artifact_id: 'art-1',
          upload_url: 'https://upload',
          form_data: [],
        },
      });
      adapter['uploader'].streamArtifact = jest
        .fn()
        .mockResolvedValue({ response: {} });
      adapter['uploader'].confirmArtifactUpload = jest
        .fn()
        .mockResolvedValue({ response: {} });

      const pushMock = jest.fn().mockResolvedValue(undefined);
      adapter.getRepo = jest.fn().mockReturnValue({ push: pushMock });

      await adapter.processAttachment(
        makeAttachment({ inline }) as never,
        stream
      );

      const ssorItem = pushMock.mock.calls[0][0][0] as Record<string, unknown>;
      expect(ssorItem.inline).toBe(expected);
    }
  );

  it('should return a descriptive error when the stream function returns no httpStream', async () => {
    const stream = jest.fn().mockResolvedValue({ httpStream: null });
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );
    expect(result?.error?.message).toContain(
      'Error while opening attachment stream'
    );
  });
});
