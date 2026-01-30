import {
  ExternalSystemAttachmentStreamingFunction,
  NormalizedAttachment,
  ProcessAttachmentReturnType,
} from 'types';
import { WorkerAdapter } from '../multithreading/worker-adapter/worker-adapter';
import { AttachmentsStreamingPool } from './attachments-streaming-pool';

// Mock types
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

    // Mock console methods
    jest.spyOn(console, 'log').mockImplementation();
    jest.spyOn(console, 'error').mockImplementation();
    jest.spyOn(console, 'warn').mockImplementation();
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

      expect(pool).toBeDefined();
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
      // Each attachment generates 2 warnings: one for the error, one for the failed attachments summary
      // Since there are 3 parallel workers (one per attachment), each logs its own failed attachment
      expect(warnSpy).toHaveBeenCalledTimes(3);

      // Verify that each attachment error was logged
      expect(warnSpy).toHaveBeenCalledWith(
        'Skipping attachment with ID attachment-image with extension jpg due to error in processAttachment function',
        imageError
      );

      expect(warnSpy).toHaveBeenCalledWith(
        'Skipping attachment with ID attachment-pdf with extension pdf due to error in processAttachment function',
        pdfError
      );

      expect(warnSpy).toHaveBeenCalledWith(
        'Skipping attachment with ID attachment-video with extension mp4 due to error in processAttachment function',
        videoError
      );

      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual([]);
    });
  });

  describe(AttachmentsStreamingPool.prototype.startPoolStreaming.name, () => {
    it('should skip already processed attachments', async () => {
      mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList =
        ['attachment-1'];
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
      ).toEqual(['attachment-1', 'attachment-2', 'attachment-3']);
    });

    it('should handle processing errors gracefully', async () => {
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

      expect(console.warn).toHaveBeenCalledWith(
        'Skipping attachment with ID attachment-2 with extension jpg due to error in processAttachment function',
        error
      );
      expect(
        mockAdapter.state.toDevRev!.attachmentsMetadata
          .lastProcessedAttachmentsIdsList
      ).toEqual(['attachment-1', 'attachment-3']);
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
      ).toEqual(['attachment-1', 'attachment-3']);
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
});
