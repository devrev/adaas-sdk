import { WorkerAdapter } from '../multithreading/worker-adapter/worker-adapter';
import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
  ProcessAttachmentReturnType,
} from '../types';
import { AttachmentsStreamingPool } from './attachments-streaming-pool';

interface TestState {
  attachments: { completed: boolean };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

describe(AttachmentsStreamingPool.name, () => {
  let mockAdapter: jest.Mocked<WorkerAdapter<TestState>>;
  let mockStream: jest.MockedFunction<ExternalSystemAttachmentStreamingFunction>;
  let mockAttachments: NormalizedAttachment[];

  beforeEach(() => {
    // Create mock adapter
    mockAdapter = {
      state: {
        attachments: { completed: false },
        toDevRev: {
          attachmentsMetadata: {
            lastProcessedAttachmentsIdsList: [],
          },
        },
      },
      isTimeout: false,
      // Never resolves: streamAll's race is decided by the workers completing,
      // unless a test overrides this / flips isTimeout.
      timeoutSignal: new Promise<void>(() => {}),
      processAttachment: jest
        .fn()
        .mockResolvedValue({} as ProcessAttachmentReturnType),
    } as any;

    // Create mock stream function
    mockStream = jest.fn().mockResolvedValue({ success: true });

    // Create mock attachments
    mockAttachments = [
      {
        id: 'attachment-1',
        url: 'https://example.com/file1.pdf',
        file_name: 'file1.pdf',
        parent_id: 'parent-1',
      },
      {
        id: 'attachment-2',
        url: 'https://example.com/file2.jpg',
        file_name: 'file2.jpg',
        parent_id: 'parent-2',
      },
      {
        id: 'attachment-3',
        url: 'https://example.com/file3.doc',
        file_name: 'file3.doc',
        parent_id: 'parent-3',
      },
    ];
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe(AttachmentsStreamingPool.prototype.constructor.name, () => {
    it('should initialize with default values', () => {
      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      expect(pool['adapter']).toBe(mockAdapter);
      expect(pool['attachments']).toEqual(mockAttachments);
      expect(pool['batchSize']).toBe(10);
      expect(pool['stream']).toBe(mockStream);
    });

    it('should initialize with custom batch size', () => {
      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        batchSize: 5,
        stream: mockStream,
      });

      expect(pool['batchSize']).toBe(5);
    });

    it('should create a copy of attachments array', () => {
      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      expect(pool['attachments']).toEqual(mockAttachments);
      expect(pool['attachments']).not.toBe(mockAttachments); // Different reference
    });
  });

  describe(AttachmentsStreamingPool.prototype.streamAll.name, () => {
    it('should initialize lastProcessedAttachmentsIdsList if it does not exist', async () => {
      mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList =
        undefined as any;
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      // Mock startPoolStreaming to avoid actual processing
      jest
        .spyOn(pool as any, 'startPoolStreaming')
        .mockResolvedValue(undefined);

      await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([]);
    });

    it('should process all attachments successfully', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      const result = await pool.streamAll();

      expect(result).toEqual({});
      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
    });

    it('should handle empty attachments array', async () => {
      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [],
        stream: mockStream,
      });

      const result = await pool.streamAll();

      expect(result).toEqual({});
      expect(mockAdapter.processAttachment).not.toHaveBeenCalled();
    });

    it('should return delay when rate limit is hit', async () => {
      const delayResponse: ProcessAttachmentReturnType = { delay: 5000 };
      mockAdapter.processAttachment.mockResolvedValue(delayResponse);

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      const result = await pool.streamAll();

      expect(result).toEqual({ delay: 5000 });
    });

    it('should resume attachment extraction if it encounters old ids', async () => {
      // Test migration from old string[] format to new ProcessedAttachment[] format
      // Using 'as any' because we're intentionally testing legacy data format
      mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList =
        ['attachment-1', 'attachment-2'] as any;

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      const result = await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev?.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([
        { id: 'attachment-1', parent_id: '' },
        { id: 'attachment-2', parent_id: '' },
        { id: 'attachment-1', parent_id: 'parent-1' },
        { id: 'attachment-2', parent_id: 'parent-2' },
        { id: 'attachment-3', parent_id: 'parent-3' },
      ]);

      expect(result).toEqual({});
    });

    it('should skip attachments that already exceeded the transient failure limit', async () => {
      mockAdapter.state.toDevRev!.attachmentsMetadata.failedAttachmentsIdsList =
        [{ id: 'attachment-1', parent_id: 'parent-1', failureCount: 3 }];
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(2); // Only 2 out of 3
    });

    it('should not skip an attachment whose failure count is below the limit', async () => {
      mockAdapter.state.toDevRev!.attachmentsMetadata.failedAttachmentsIdsList =
        [{ id: 'attachment-1', parent_id: 'parent-1', failureCount: 1 }];
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
    });

    it('should record a transient failure', async () => {
      mockAdapter.processAttachment.mockResolvedValueOnce({
        error: { message: 'timeout', isTransient: true },
      });

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        stream: mockStream,
        batchSize: 1,
      });

      await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata.failedAttachmentsIdsList
      ).toEqual([
        { id: 'attachment-1', parent_id: 'parent-1', failureCount: 1 },
      ]);
    });

    it('should not record a failure for a non-transient error', async () => {
      mockAdapter.processAttachment.mockResolvedValueOnce({
        error: { message: 'File size is 0 or less.' },
      });

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        stream: mockStream,
        batchSize: 1,
      });

      await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata.failedAttachmentsIdsList
      ).toEqual([]);
    });

    it('should permanently skip an attachment once it reaches the configured maxAttachmentFailures', async () => {
      (mockAdapter as any).options = { maxAttachmentFailures: 2 };
      mockAdapter.state.toDevRev!.attachmentsMetadata.failedAttachmentsIdsList =
        [{ id: 'attachment-1', parent_id: 'parent-1', failureCount: 1 }];
      mockAdapter.processAttachment.mockResolvedValueOnce({
        error: { message: 'timeout', isTransient: true },
      });

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        stream: mockStream,
        batchSize: 1,
      });

      await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata.failedAttachmentsIdsList
      ).toEqual([
        { id: 'attachment-1', parent_id: 'parent-1', failureCount: 2 },
      ]);

      // A subsequent run should now skip it entirely instead of calling processAttachment again.
      mockAdapter.processAttachment.mockClear();
      const secondPool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        stream: mockStream,
        batchSize: 1,
      });

      await secondPool.streamAll();

      expect(mockAdapter.processAttachment).not.toHaveBeenCalled();
    });

    it('should handle all attachments failing with different file types and sizes', async () => {
      const largeAttachments: NormalizedAttachment[] = [
        {
          id: 'attachment-image',
          url: 'https://example.com/photo.jpg',
          file_name: 'photo.jpg',
          parent_id: 'parent-1',
        },
        {
          id: 'attachment-pdf',
          url: 'https://example.com/document.pdf',
          file_name: 'document.pdf',
          parent_id: 'parent-2',
        },
        {
          id: 'attachment-video',
          url: 'https://example.com/video.mp4',
          file_name: 'video.mp4',
          parent_id: 'parent-3',
        },
      ];

      const imageError = new Error('Image upload failed: File too large');
      const pdfError = new Error('PDF upload failed: Unsupported format');
      const videoError = new Error('Video upload failed: Network error');

      mockAdapter.processAttachment
        .mockRejectedValueOnce(imageError)
        .mockRejectedValueOnce(pdfError)
        .mockRejectedValueOnce(videoError);

      const warnSpy = jest.spyOn(console, 'warn');

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: largeAttachments,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
      // Since there are 3 parallel workers (one per attachment), each logs its own failed attachment
      expect(warnSpy).toHaveBeenCalledTimes(3);

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([]);
    });
  });

  describe(AttachmentsStreamingPool.prototype.startPoolStreaming.name, () => {
    it('should skip already processed attachments', async () => {
      mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList =
        [{ id: 'attachment-1', parent_id: 'parent-1' }];
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(2); // Only 2 out of 3
    });

    it('should add successfully processed attachment IDs to the list', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([
        { id: 'attachment-1', parent_id: 'parent-1' },
        { id: 'attachment-2', parent_id: 'parent-2' },
        { id: 'attachment-3', parent_id: 'parent-3' },
      ]);
    });

    it('should handle processing errors gracefully', async () => {
      const warnSpy = jest.spyOn(console, 'warn').mockImplementation();
      const error = new Error('Processing failed');
      mockAdapter.processAttachment
        .mockResolvedValueOnce({}) // First attachment succeeds
        .mockRejectedValueOnce(error) // Second attachment fails
        .mockResolvedValueOnce({}); // Third attachment succeeds

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(warnSpy).toHaveBeenCalledWith(
        'Skipping attachment with ID attachment-2 with extension jpg due to error in processAttachment function',
        error
      );
      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([
        {
          id: 'attachment-1',
          parent_id: 'parent-1',
        },
        {
          id: 'attachment-3',
          parent_id: 'parent-3',
        },
      ]);
    });

    it('should stop processing when rate limit delay is encountered', async () => {
      mockAdapter.processAttachment
        .mockResolvedValueOnce({}) // First attachment succeeds
        .mockResolvedValueOnce({ delay: 5000 }) // Second attachment triggers rate limit
        .mockResolvedValueOnce({}); // Third attachment succeeds

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([
        { id: 'attachment-1', parent_id: 'parent-1' },
        { id: 'attachment-3', parent_id: 'parent-3' },
      ]);
    });

    it('should pass correct parameters to processAttachment', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledWith(
        mockAttachments[0],
        mockStream
      );
    });
  });

  it('[edge] should handle single attachment', async () => {
    mockAdapter.processAttachment.mockResolvedValue({});

    const pool = new AttachmentsStreamingPool({
      adapter: mockAdapter,
      attachments: [mockAttachments[0]],
      stream: mockStream,
    });

    const result = await pool.streamAll();

    expect(result).toEqual({});
    expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(1);
  });

  it('[edge] should handle batch size larger than attachments array', async () => {
    mockAdapter.processAttachment.mockResolvedValue({});

    const pool = new AttachmentsStreamingPool({
      adapter: mockAdapter,
      attachments: mockAttachments,
      batchSize: 100,
      stream: mockStream,
    });

    await pool.streamAll();

    expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
  });

  it('[edge] should upload attachments with same id, but different parent_id', async () => {
    mockAdapter.processAttachment.mockResolvedValue({});

    mockAttachments.push({
      id: 'attachment-1',
      url: 'http://example.com/file5.jpg',
      file_name: 'file5.jpg',
      parent_id: 'parent-4',
    });

    const pool = new AttachmentsStreamingPool({
      adapter: mockAdapter,
      attachments: mockAttachments,
      batchSize: 1,
      stream: mockStream,
    });

    await pool.streamAll();

    expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(4);
  });

  it('[edge] should handle batch size of 1', async () => {
    mockAdapter.processAttachment.mockResolvedValue({});

    const pool = new AttachmentsStreamingPool({
      adapter: mockAdapter,
      attachments: mockAttachments,
      batchSize: 1,
      stream: mockStream,
    });

    await pool.streamAll();

    expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
  });

  describe('content_type handling', () => {
    it('should pass attachment with content_type to processAttachment', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const attachmentWithContentType: NormalizedAttachment = {
        id: 'attachment-ct',
        url: 'https://example.com/report.pdf',
        file_name: 'report.pdf',
        parent_id: 'parent-ct',
        content_type: 'application/pdf',
      };

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [attachmentWithContentType],
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledWith(
        attachmentWithContentType,
        mockStream
      );
      expect(mockAdapter.processAttachment.mock.calls[0][0].content_type).toBe(
        'application/pdf'
      );
    });

    it('should handle mixed attachments with and without content_type', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const mixedAttachments: NormalizedAttachment[] = [
        {
          id: 'att-with-ct',
          url: 'https://example.com/image.png',
          file_name: 'image.png',
          parent_id: 'parent-1',
          content_type: 'image/png',
        },
        {
          id: 'att-without-ct',
          url: 'https://example.com/file.bin',
          file_name: 'file.bin',
          parent_id: 'parent-2',
        },
        {
          id: 'att-with-ct-2',
          url: 'https://example.com/doc.pdf',
          file_name: 'doc.pdf',
          parent_id: 'parent-3',
          content_type: 'application/pdf',
        },
      ];

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mixedAttachments,
        batchSize: 1,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
      expect(mockAdapter.processAttachment.mock.calls[0][0].content_type).toBe(
        'image/png'
      );
      expect(
        mockAdapter.processAttachment.mock.calls[1][0].content_type
      ).toBeUndefined();
      expect(mockAdapter.processAttachment.mock.calls[2][0].content_type).toBe(
        'application/pdf'
      );
    });

    it('should include content_type in error log when processAttachment returns error', async () => {
      mockAdapter.processAttachment.mockResolvedValue({
        error: { message: 'Upload failed' },
      });

      const warnSpy = jest.spyOn(console, 'warn');

      const attachmentWithContentType: NormalizedAttachment = {
        id: 'att-error-ct',
        url: 'https://example.com/file.pdf',
        file_name: 'file.pdf',
        parent_id: 'parent-err',
        content_type: 'application/pdf',
      };

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [attachmentWithContentType],
        batchSize: 1,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('content_type application/pdf'),
        expect.any(String)
      );
    });

    it('should include content_type in error log when processAttachment throws', async () => {
      const error = new Error('Processing crashed');
      mockAdapter.processAttachment.mockRejectedValue(error);

      const warnSpy = jest.spyOn(console, 'warn');

      const attachmentWithContentType: NormalizedAttachment = {
        id: 'att-throw-ct',
        url: 'https://example.com/file.png',
        file_name: 'file.png',
        parent_id: 'parent-throw',
        content_type: 'image/png',
      };

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [attachmentWithContentType],
        batchSize: 1,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('content_type image/png'),
        error
      );
    });

    it('should not include content_type in error log when content_type is not set', async () => {
      mockAdapter.processAttachment.mockResolvedValue({
        error: { message: 'Upload failed' },
      });

      const warnSpy = jest.spyOn(console, 'warn');

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        batchSize: 1,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.not.stringContaining('content_type'),
        expect.any(String)
      );
    });
  });

  describe('concurrency behavior', () => {
    it('should process attachments concurrently within batch size', async () => {
      let processCallCount = 0;
      const processPromises: Promise<ProcessAttachmentReturnType>[] = [];

      mockAdapter.processAttachment.mockImplementation(async () => {
        const promise = new Promise<ProcessAttachmentReturnType>((resolve) => {
          setTimeout(() => {
            processCallCount++;
            resolve({});
          }, 100);
        });
        processPromises.push(promise);
        return promise;
      });

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        batchSize: 2,
        stream: mockStream,
      });

      const startTime = Date.now();
      await pool.streamAll();
      const endTime = Date.now();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
      expect(processCallCount).toBe(3);

      // Should complete in roughly 200ms (2 batches of 100ms each) rather than 300ms (sequential)
      expect(endTime - startTime).toBeLessThan(250);
    });
  });

  describe('log context attribution', () => {
    it('should emit SDK-generated logs from pool (Starting download message)', async () => {
      const logSpy = jest.spyOn(console, 'log');
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments.slice(0, 1),
        stream: mockStream,
      });

      // Call streamAll - it should log "Starting download of N attachments..."
      await pool.streamAll();

      // Verify the SDK-generated "Starting download" message was logged
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting download of 1 attachments')
      );
    });

    it('should process user stream callback correctly while maintaining context isolation', async () => {
      let userCallbackExecuted = false;

      // Mock stream to capture context info
      const mockStreamFn: ExternalSystemAttachmentStreamingFunction = jest
        .fn()
        .mockImplementation(async () => {
          await Promise.resolve();
          userCallbackExecuted = true;
          // Record that the callback executed
          return Promise.resolve({
            httpStream: undefined,
            error: undefined,
          });
        });

      mockAdapter.processAttachment.mockImplementation(
        async (attachment, stream) => {
          // processAttachment should be called with the user's stream function
          const result = await stream({
            item: attachment,
            event: {} as any,
          });
          return result;
        }
      );

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments.slice(0, 1),
        stream: mockStreamFn,
      });

      await pool.streamAll();

      // Verify the user callback was executed
      expect(userCallbackExecuted).toBe(true);
      expect(mockStreamFn).toHaveBeenCalled();
    });
  });

  describe('soft timeout handling', () => {
    it('should resolve streamAll when the timeout signal fires even if a worker is stuck in flight', async () => {
      // A worker stuck in a never-resolving request: only the timeout race can
      // unblock streamAll.
      mockAdapter.processAttachment.mockImplementation(
        async () => new Promise<ProcessAttachmentReturnType>(() => {})
      );

      let fireTimeout!: () => void;
      (mockAdapter as any).timeoutSignal = new Promise<void>((resolve) => {
        fireTimeout = resolve;
      });

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        batchSize: 10,
        stream: mockStream,
      });

      const streamAllPromise = pool.streamAll();

      (mockAdapter as any).isTimeout = true;
      fireTimeout();

      const result = await streamAllPromise;
      expect(result).toEqual({});
    });

    it('should not record an attachment as processed when a timeout fires while it is in flight', async () => {
      mockAdapter.processAttachment.mockImplementation(async () => {
        await Promise.resolve();
        (mockAdapter as any).isTimeout = true;
        return {};
      });

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        batchSize: 1,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([]);
      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(1);
    });

    it('should record attachments completed before the timeout and stop after', async () => {
      let calls = 0;
      mockAdapter.processAttachment.mockImplementation(async () => {
        await Promise.resolve();
        calls++;
        if (calls === 2) {
          (mockAdapter as any).isTimeout = true;
        }
        return {};
      });

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        batchSize: 1,
        stream: mockStream,
      });

      await pool.streamAll();

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([{ id: 'attachment-1', parent_id: 'parent-1' }]);
      // 2nd was started then abandoned; 3rd never started.
      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(2);
    });
  });
});
