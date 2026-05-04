import { AttachmentsStreamingPool } from '../../attachments-streaming/attachments-streaming-pool';
import { State } from '../../state/state';
import { mockServer } from '../../tests/jest.setup';
import { createMockEvent } from '../../common/test-utils';
import {
  AdapterState,
  AirdropEvent,
  Artifact,
  EventType,
  ExtractorEventType,
} from '../../types';
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

interface TestState {
  attachments: { completed: boolean };
}

function makeAdapter(eventType: EventType = EventType.StartExtractingData): {
  adapter: WorkerAdapter<TestState>;
  event: AirdropEvent;
  adapterState: State<TestState>;
} {
  const event = createMockEvent(mockServer.baseUrl, {
    payload: { event_type: eventType },
  });
  const initialState: AdapterState<TestState> = {
    attachments: { completed: false },
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
  };
  const adapterState = new State<TestState>({ event, initialState });
  const adapter = new WorkerAdapter<TestState>({ event, adapterState });
  return { adapter, event, adapterState };
}

describe(`${WorkerAdapter.name}.streamAttachments`, () => {
  let adapter: WorkerAdapter<TestState>;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter());
  });

  it('should process all artifact batches successfully', async () => {
    const mockStream = jest.fn();

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1', 'artifact2'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValueOnce({
        attachments: [
          {
            url: 'http://example.com/file1.pdf',
            id: 'attachment1',
            file_name: 'file1.pdf',
            parent_id: 'parent1',
          },
          {
            url: 'http://example.com/file2.pdf',
            id: 'attachment2',
            file_name: 'file2.pdf',
            parent_id: 'parent2',
          },
        ],
      })
      .mockResolvedValueOnce({
        attachments: [
          {
            url: 'http://example.com/file3.pdf',
            id: 'attachment3',
            file_name: 'file3.pdf',
            parent_id: 'parent3',
          },
        ],
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(adapter.initializeRepos).toHaveBeenCalledWith([
      { itemType: 'ssor_attachment' },
    ]);
    expect(adapter.initializeRepos).toHaveBeenCalledTimes(1);
    expect(
      adapter['uploader'].getAttachmentsFromArtifactId
    ).toHaveBeenCalledTimes(2);

    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([]);
    expect(adapter.state.toDevRev.attachmentsMetadata.lastProcessed).toBe(0);
    expect(result).toBeUndefined();
  });

  it('[edge] should handle invalid batch size by using 1 instead', async () => {
    const mockStream = jest.fn();

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        attachments: [
          {
            url: 'http://example.com/file1.pdf',
            id: 'attachment1',
            file_name: 'file1.pdf',
            parent_id: 'parent1',
          },
        ],
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
      batchSize: 0,
    });

    expect(result).toBeUndefined();
  });

  it('[edge] should cap batch size to 50 when batchSize is greater than 50', async () => {
    const mockStream = jest.fn();

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        attachments: [
          {
            url: 'http://example.com/file1.pdf',
            id: 'attachment1',
            file_name: 'file1.pdf',
            parent_id: 'parent1',
          },
        ],
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
      batchSize: 100,
    });

    expect(result).toBeUndefined();
  });

  it('[edge] should handle empty attachments metadata artifact IDs', async () => {
    const mockStream = jest.fn();

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: [],
        lastProcessed: 0,
      },
    };

    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(result).toBeUndefined();
  });

  it('[edge] should handle errors when getting attachments', async () => {
    const mockStream = jest.fn();

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    const mockError = new Error('Failed to get attachments');
    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        error: mockError,
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(result).toEqual({
      error: mockError,
    });
  });

  it('[edge] should handle empty attachments array from artifact', async () => {
    const mockStream = jest.fn();

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        attachments: [],
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([]);
    expect(result).toBeUndefined();
  });

  it('should use custom processors when provided', async () => {
    const mockStream = jest.fn();
    const mockReducer = jest.fn().mockReturnValue(['custom-reduced']);
    const mockIterator = jest.fn().mockResolvedValue({});

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        attachments: [{ id: 'attachment1' }],
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
      processors: {
        reducer: mockReducer,
        iterator: mockIterator,
      },
    });

    expect(mockReducer).toHaveBeenCalledWith({
      attachments: [{ id: 'attachment1' }],
      adapter: adapter,
      batchSize: 1,
    });
    expect(mockIterator).toHaveBeenCalledWith({
      reducedAttachments: ['custom-reduced'],
      adapter: adapter,
      stream: mockStream,
    });
    expect(result).toBeUndefined();
  });

  it('should handle rate limiting from iterator', async () => {
    const mockStream = jest.fn();

    (AttachmentsStreamingPool as jest.Mock).mockImplementationOnce(() => ({
      streamAll: jest.fn().mockResolvedValue({ delay: 30 }),
    }));

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        attachments: [{ id: 'attachment1' }],
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(result).toEqual({ delay: 30 });
    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
      'artifact1',
    ]);
  });

  it('should handle error from iterator', async () => {
    const mockStream = jest.fn();

    (AttachmentsStreamingPool as jest.Mock).mockImplementationOnce(() => ({
      streamAll: jest.fn().mockResolvedValue({
        error: 'Mock error',
      }),
    }));

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        attachments: [{ id: 'attachment1' }],
      });

    adapter.initializeRepos = jest.fn();

    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(result).toEqual({ error: 'Mock error' });
    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
      'artifact1',
    ]);
  });

  it('should emit progress event and exit process on timeout, preserving state for resumption', async () => {
    const mockStream = jest.fn();

    const exitSpy = jest
      .spyOn(process, 'exit')
      .mockImplementation(() => undefined as never);

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1', 'artifact2', 'artifact3'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };

    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValue({
        attachments: [
          {
            url: 'http://example.com/file1.pdf',
            id: 'attachment1',
            file_name: 'file1.pdf',
            parent_id: 'parent1',
          },
        ],
      });

    (AttachmentsStreamingPool as jest.Mock).mockImplementationOnce(() => ({
      streamAll: jest.fn().mockImplementation(() => {
        adapter.isTimeout = true;
        return {};
      }),
    }));

    adapter.initializeRepos = jest.fn();

    const emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();

    await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(emitSpy).toHaveBeenCalledWith(
      ExtractorEventType.AttachmentExtractionProgress
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
      'artifact1',
      'artifact2',
      'artifact3',
    ]);
    expect(
      adapter['uploader'].getAttachmentsFromArtifactId
    ).toHaveBeenCalledTimes(1);

    exitSpy.mockRestore();
  });

  it('should reset lastProcessed and attachment IDs list after processing all artifacts', async () => {
    const mockStream = jest.fn();
    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: ['artifact1'],
        lastProcessed: 0,
        lastProcessedAttachmentsIdsList: [],
      },
    };
    adapter['uploader'].getAttachmentsFromArtifactId = jest
      .fn()
      .mockResolvedValueOnce({
        attachments: [
          {
            url: 'http://example.com/file1.pdf',
            id: 'attachment1',
            file_name: 'file1.pdf',
            parent_id: 'parent1',
          },
          {
            url: 'http://example.com/file2.pdf',
            id: 'attachment2',
            file_name: 'file2.pdf',
            parent_id: 'parent2',
          },
          {
            url: 'http://example.com/file3.pdf',
            id: 'attachment3',
            file_name: 'file3.pdf',
            parent_id: 'parent3',
          },
        ],
      });

    adapter.processAttachment = jest.fn().mockResolvedValue(null);

    await adapter.streamAttachments({
      stream: mockStream,
    });

    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toHaveLength(
      0
    );
    expect(adapter.state.toDevRev.attachmentsMetadata.lastProcessed).toBe(0);
  });
});

describe(`${WorkerAdapter.name}.processAttachment`, () => {
  let adapter: WorkerAdapter<TestState>;

  beforeEach(() => {
    jest.clearAllMocks();
    ({ adapter } = makeAdapter(EventType.StartExtractingAttachments));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const createMockHttpStream = (headers: Record<string, string> = {}) => ({
    headers,
    data: { destroy: jest.fn() },
  });

  const makeAttachment = (overrides = {}) => ({
    id: 'att-1',
    url: 'https://example.com/file.pdf',
    file_name: 'file.pdf',
    parent_id: 'parent-1',
    content_type: 'application/pdf',
    ...overrides,
  });

  function setupUploaderHappyPath() {
    adapter['uploader'].getArtifactUploadUrl = jest.fn().mockResolvedValue({
      response: {
        artifact_id: 'art_1',
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
    return pushMock;
  }

  // ---- content-type resolution (existing tests) ----
  it('should use attachment.content_type when provided, ignoring HTTP header', async () => {
    setupUploaderHappyPath();
    const mockStream = jest.fn().mockResolvedValue({
      httpStream: createMockHttpStream({
        'content-type': 'text/plain',
        'content-length': '100',
      }),
    });

    await adapter.processAttachment(
      makeAttachment({ content_type: 'application/pdf' }) as never,
      mockStream
    );

    expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
      'file.pdf',
      'application/pdf',
      100
    );
  });

  it('should use HTTP header content-type when attachment.content_type is not set', async () => {
    setupUploaderHappyPath();
    const mockStream = jest.fn().mockResolvedValue({
      httpStream: createMockHttpStream({
        'content-type': 'image/jpeg',
        'content-length': '200',
      }),
    });

    const attachment = {
      id: 'att-2',
      url: 'https://example.com/photo.jpg',
      file_name: 'photo.jpg',
      parent_id: 'parent-2',
    };

    await adapter.processAttachment(attachment as never, mockStream);

    expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
      'photo.jpg',
      'image/jpeg',
      200
    );
  });

  it('should fall back to application/octet-stream when neither content_type nor HTTP header is set', async () => {
    setupUploaderHappyPath();
    const mockStream = jest.fn().mockResolvedValue({
      httpStream: createMockHttpStream({}),
    });

    const attachment = {
      id: 'att-3',
      url: 'https://example.com/file.bin',
      file_name: 'file.bin',
      parent_id: 'parent-3',
    };

    await adapter.processAttachment(attachment as never, mockStream);

    expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
      'file.bin',
      'application/octet-stream',
      undefined
    );
  });

  // ---- error paths (ported from coverage file) ----
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
      .mockResolvedValue({ httpStream: createMockHttpStream() });
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
      .mockResolvedValue({ httpStream: createMockHttpStream() });
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
      .mockResolvedValue({ httpStream: createMockHttpStream() });
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
      const pushMock = setupUploaderHappyPath();
      const stream = jest
        .fn()
        .mockResolvedValue({ httpStream: createMockHttpStream() });

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

describe(`${WorkerAdapter.name}.initializeRepos — event size threshold`, () => {
  it('should set isTimeout=true once the cumulative artifact payload exceeds EVENT_SIZE_THRESHOLD_BYTES', () => {
    const { adapter } = makeAdapter();

    let capturedOnUpload: ((artifact: Artifact) => void) | undefined;
    const { Repo } = require('../../repo/repo');
    (Repo as jest.Mock).mockImplementationOnce(
      (opts: { onUpload: (a: Artifact) => void }) => {
        capturedOnUpload = opts.onUpload;
        return { itemType: 'issues', upload: jest.fn(), uploadedArtifacts: [] };
      }
    );

    adapter.initializeRepos([{ itemType: 'issues' }]);
    expect(capturedOnUpload).toBeDefined();

    capturedOnUpload!({
      id: 'artifact-x',
      item_count: 1,
      item_type: 'x'.repeat(200_000),
    });

    expect(adapter.isTimeout).toBe(true);
  });
});

describe(`${WorkerAdapter.name}.getRepo`, () => {
  it('should return undefined and log an error when the requested repo was never initialised', () => {
    const { adapter } = makeAdapter();
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

describe(`${WorkerAdapter.name}.destroyHttpStream`, () => {
  let adapter: WorkerAdapter<TestState>;

  beforeEach(() => {
    ({ adapter } = makeAdapter());
  });

  afterEach(() => {
    jest.restoreAllMocks();
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

    if (expectDestroy) {
      expect((data as { destroy: jest.Mock }).destroy).toHaveBeenCalled();
    }
    if (expectClose) {
      expect((data as { close: jest.Mock }).close).toHaveBeenCalled();
    }
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

describe(`${WorkerAdapter.name} — extractionScope`, () => {
  it('should return empty object by default', () => {
    const { adapter } = makeAdapter();
    expect(adapter.extractionScope).toEqual({});
  });

  it('should return extraction scope from adapter state', () => {
    const { adapter, adapterState } = makeAdapter();
    const extractionScope = {
      tasks: { extract: true },
      users: { extract: false },
    };

    (
      adapterState as unknown as {
        _extractionScope: Record<string, { extract: boolean }>;
      }
    )._extractionScope = extractionScope;

    expect(adapter.extractionScope).toEqual(extractionScope);
  });
});

describe(`${WorkerAdapter.name} — shouldExtract`, () => {
  it('should return true when extraction scope is empty', () => {
    const { adapter } = makeAdapter();
    expect(adapter.shouldExtract('tasks')).toBe(true);
    expect(adapter.shouldExtract('users')).toBe(true);
  });

  it('should return true when item type is not in scope', () => {
    const { adapter, adapterState } = makeAdapter();
    (
      adapterState as unknown as {
        _extractionScope: Record<string, { extract: boolean }>;
      }
    )._extractionScope = {
      tasks: { extract: true },
    };
    expect(adapter.shouldExtract('users')).toBe(true);
  });

  it('should return true when item type has extract: true', () => {
    const { adapter, adapterState } = makeAdapter();
    (
      adapterState as unknown as {
        _extractionScope: Record<string, { extract: boolean }>;
      }
    )._extractionScope = {
      tasks: { extract: true },
    };
    expect(adapter.shouldExtract('tasks')).toBe(true);
  });

  it('should return false when item type has extract: false', () => {
    const { adapter, adapterState } = makeAdapter();
    (
      adapterState as unknown as {
        _extractionScope: Record<string, { extract: boolean }>;
      }
    )._extractionScope = {
      tasks: { extract: false },
      users: { extract: true },
    };
    expect(adapter.shouldExtract('tasks')).toBe(false);
    expect(adapter.shouldExtract('users')).toBe(true);
  });
});
