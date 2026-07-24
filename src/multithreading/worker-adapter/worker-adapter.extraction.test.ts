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
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
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
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
      batchSize: 0,
    });

    // Assert
    expect(result).toBeUndefined();
  });

  it('[edge] should cap batch size to 50 when batchSize is greater than 50', async () => {
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
      batchSize: 100,
    });

    // Assert
    expect(result).toBeUndefined();
  });

  it('[edge] should handle empty attachments metadata artifact IDs', async () => {
    // Arrange
    const mockStream = jest.fn();

    adapter.state.toDevRev = {
      attachmentsMetadata: {
        artifactIds: [],
        lastProcessed: 0,
      },
    };

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
    expect(result).toBeUndefined();
  });

  it('[edge] should handle errors when getting attachments', async () => {
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
    expect(result).toEqual({
      error: mockError,
    });
  });

  it('[edge] should handle empty attachments array from artifact', async () => {
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([]);
    expect(result).toBeUndefined();
  });

  it('should use custom processors when provided', async () => {
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
      processors: {
        reducer: mockReducer,
        iterator: mockIterator,
      },
    });

    // Assert
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
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
    expect(result).toEqual({ delay: 30 });
    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
      'artifact1',
    ]);
  });

  it('should handle error from iterator', async () => {
    // Arrange
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

    // Act
    const result = await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
    expect(result).toEqual({ error: 'Mock error' });
    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
      'artifact1',
    ]);
  });

  it('should emit progress event and exit process on timeout, preserving state for resumption', async () => {
    // Arrange
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

    // Act
    await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
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

  it('should stop after the timeout flips between batches and preserve unprocessed artifacts for resumption', async () => {
    // Arrange: three artifacts. The first batch's streamAll completes
    // successfully; the second sets isTimeout=true mid-run. The third batch
    // must never be reached.
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
            url: 'http://example.com/file.pdf',
            id: 'attachment-x',
            file_name: 'file.pdf',
            parent_id: 'parent-x',
          },
        ],
      });

    // First call: clean streamAll. Second call: flip isTimeout AFTER streaming.
    (AttachmentsStreamingPool as jest.Mock)
      .mockImplementationOnce(() => ({
        streamAll: jest.fn().mockResolvedValue({}),
      }))
      .mockImplementationOnce(() => ({
        streamAll: jest.fn().mockImplementation(() => {
          adapter.isTimeout = true;
          return {};
        }),
      }));

    adapter.initializeRepos = jest.fn();
    const emitSpy = jest.spyOn(adapter, 'emit').mockResolvedValue();

    // Act
    await adapter.streamAttachments({ stream: mockStream });

    // Assert
    // - Fetched attachments for the first two artifacts only; the third never ran
    expect(
      adapter['uploader'].getAttachmentsFromArtifactId
    ).toHaveBeenCalledTimes(2);
    // - Progress emitted and process.exit(0) called once the timeout was detected
    expect(emitSpy).toHaveBeenCalledWith(
      ExtractorEventType.AttachmentExtractionProgress
    );
    expect(exitSpy).toHaveBeenCalledWith(0);
    // - Artifact 1 was shifted out cleanly; artifact 2 remains (timeout caught
    //   before its shift) along with the untouched artifact 3
    expect(adapter.state.toDevRev.attachmentsMetadata.artifactIds).toEqual([
      'artifact2',
      'artifact3',
    ]);

    exitSpy.mockRestore();
  });

  it('should reset lastProcessed and attachment IDs list after processing all artifacts', async () => {
    // Arrange
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

    // Act
    await adapter.streamAttachments({
      stream: mockStream,
    });

    // Assert
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

  // ---- content-type resolution ----
  it('should use attachment.content_type when provided, ignoring HTTP header', async () => {
    // Arrange
    setupUploaderHappyPath();
    const mockStream = jest.fn().mockResolvedValue({
      httpStream: createMockHttpStream({
        'content-type': 'text/plain',
        'content-length': '100',
      }),
    });

    // Act
    await adapter.processAttachment(
      makeAttachment({ content_type: 'application/pdf' }) as never,
      mockStream
    );

    // Assert
    expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
      'file.pdf',
      'application/pdf',
      100
    );
  });

  it('should use HTTP header content-type when attachment.content_type is not set', async () => {
    // Arrange
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

    // Act
    await adapter.processAttachment(attachment as never, mockStream);

    // Assert
    expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
      'photo.jpg',
      'image/jpeg',
      200
    );
  });

  it('should fall back to application/octet-stream when neither content_type nor HTTP header is set', async () => {
    // Arrange
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

    // Act
    await adapter.processAttachment(attachment as never, mockStream);

    // Assert
    expect(adapter['uploader'].getArtifactUploadUrl).toHaveBeenCalledWith(
      'file.bin',
      'application/octet-stream',
      undefined
    );
  });

  // ---- error paths ----
  it('should return the stream error message when the stream function returns an error', async () => {
    // Arrange
    const stream = jest
      .fn()
      .mockResolvedValue({ error: new Error('stream failed') });

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.message).toBe('stream failed');
    expect(result?.error?.isTransient).toBe(false);
  });

  it('should classify a stream error with a 5xx statusCode as transient', async () => {
    // Arrange
    const stream = jest.fn().mockResolvedValue({
      error: { message: 'export failed', statusCode: 500 },
    });

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.isTransient).toBe(true);
  });

  it('should not classify a stream error with a 4xx statusCode as transient', async () => {
    // Arrange
    const stream = jest.fn().mockResolvedValue({
      error: { message: 'not found', statusCode: 404 },
    });

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.isTransient).toBe(false);
  });

  it('should not classify a stream error without a statusCode as transient', async () => {
    // Arrange
    const stream = jest.fn().mockResolvedValue({
      error: { message: 'unknown failure' },
    });

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.isTransient).toBe(false);
  });

  it('should propagate a rate-limit delay from the stream function', async () => {
    // Arrange
    const stream = jest.fn().mockResolvedValue({ delay: 5 });

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.delay).toBe(5);
  });

  it('should return an error containing the attachment ID when getArtifactUploadUrl fails', async () => {
    // Arrange
    const stream = jest
      .fn()
      .mockResolvedValue({ httpStream: createMockHttpStream() });
    adapter['uploader'].getArtifactUploadUrl = jest
      .fn()
      .mockResolvedValue({ error: new Error('upload url failed') });

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.message).toContain('att-1');
    expect(result?.error?.message).toContain('preparing artifact');
  });

  it('should return an error when streamArtifact fails', async () => {
    // Arrange
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

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.message).toContain('streaming to artifact');
  });

  it('should return an error when confirmArtifactUpload fails', async () => {
    // Arrange
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

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.message).toContain('confirming upload');
  });

  it.each([
    { inline: true, expected: true },
    { inline: false, expected: false },
  ])(
    'should set inline=$expected on the ssorAttachment when attachment.inline=$inline',
    async ({ inline, expected }) => {
      // Arrange
      const pushMock = setupUploaderHappyPath();
      const stream = jest
        .fn()
        .mockResolvedValue({ httpStream: createMockHttpStream() });

      // Act
      await adapter.processAttachment(
        makeAttachment({ inline }) as never,
        stream
      );

      // Assert
      const ssorItem = pushMock.mock.calls[0][0][0] as Record<string, unknown>;
      expect(ssorItem.inline).toBe(expected);
    }
  );

  it('should return a descriptive error when the stream function returns no httpStream', async () => {
    // Arrange
    const stream = jest.fn().mockResolvedValue({ httpStream: null });

    // Act
    const result = await adapter.processAttachment(
      makeAttachment() as never,
      stream
    );

    // Assert
    expect(result?.error?.message).toContain(
      'Error while opening attachment stream'
    );
  });
});

describe(`${WorkerAdapter.name}.initializeRepos — event size threshold`, () => {
  it('should set isTimeout=true once the cumulative artifact payload exceeds EVENT_SIZE_THRESHOLD_BYTES', () => {
    // Arrange
    const { adapter } = makeAdapter();

    let capturedOnUpload: ((artifact: Artifact) => void) | undefined;
    const { Repo } = require('../../repo/repo');
    (Repo as jest.Mock).mockImplementationOnce(
      (opts: { onUpload: (a: Artifact) => void }) => {
        capturedOnUpload = opts.onUpload;
        return { itemType: 'issues', upload: jest.fn(), uploadedArtifacts: [] };
      }
    );

    // Act
    adapter.initializeRepos([{ itemType: 'issues' }]);
    expect(capturedOnUpload).toBeDefined();
    capturedOnUpload!({
      id: 'artifact-x',
      item_count: 1,
      item_type: 'x'.repeat(200_000),
    });

    // Assert
    expect(adapter.isTimeout).toBe(true);
  });
});

describe(`${WorkerAdapter.name}.getRepo`, () => {
  it('should return undefined when the requested repo was never initialised', () => {
    // Arrange
    const { adapter } = makeAdapter();

    // Act
    const result = adapter.getRepo('non-existent-type');

    // Assert
    expect(result).toBeUndefined();
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
    // Arrange
    const httpStream = { data } as never;

    // Act & Assert
    expect(() => adapter['destroyHttpStream'](httpStream)).not.toThrow();

    if (expectDestroy) {
      expect((data as { destroy: jest.Mock }).destroy).toHaveBeenCalled();
    }
    if (expectClose) {
      expect((data as { close: jest.Mock }).close).toHaveBeenCalled();
    }
  });

  it('should not re-throw when destroy() itself throws', () => {
    // Arrange
    const httpStream = {
      data: {
        destroy: () => {
          throw new Error('stream error');
        },
      },
    };

    // Act & Assert
    expect(() =>
      adapter['destroyHttpStream'](httpStream as never)
    ).not.toThrow();
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
