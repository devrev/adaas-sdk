import { AttachmentsStreamingPool } from './attachments-streaming-pool';
import { WorkerAdapter } from '../workers/worker-adapter';
import {
  NormalizedAttachment,
  ExternalSystemAttachmentStreamingFunction,
  ProcessAttachmentReturnType
} from 'types';

// Mock types
interface TestState {
    attachments: { completed: boolean };
}

describe('AttachmentsStreamingPool', () => {
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
            lastProcessedAttachmentsIdsList: []
          }
        }
      },
      processAttachment: jest.fn().mockResolvedValue({} as ProcessAttachmentReturnType)
    } as any;

    // Create mock stream function
    mockStream = jest.fn().mockResolvedValue({ success: true });

    // Create mock attachments
    mockAttachments = [
      {
        id: 'attachment-1',
        url: 'https://example.com/file1.pdf',
        file_name: 'file1.pdf',
        parent_id: 'parent-1'
      },
      {
        id: 'attachment-2',
        url: 'https://example.com/file2.jpg',
        file_name: 'file2.jpg',
        parent_id: 'parent-2'
      },
      {
        id: 'attachment-3',
        url: 'https://example.com/file3.doc',
        file_name: 'file3.doc',
        parent_id: 'parent-3'
      }
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

  describe('constructor', () => {
    it('should initialize with default values', () => {
      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream
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
        stream: mockStream
      });

      expect(pool['batchSize']).toBe(5);
    });

    it('should create a copy of attachments array', () => {
      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream
      });

      expect(pool['attachments']).toEqual(mockAttachments);
      expect(pool['attachments']).not.toBe(mockAttachments); // Different reference
    });
  });

  describe('streamAll', () => {
    it('should initialize lastProcessedAttachmentsIdsList if it does not exist', async () => {
      mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList = undefined as any;
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream
      });

      // Mock startPoolStreaming to avoid actual processing
      jest.spyOn(pool as any, 'startPoolStreaming').mockResolvedValue(undefined);

      await pool.streamAll();

      expect(mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList).toEqual([]);
    });

    it('should process all attachments successfully', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream
      });

      const result = await pool.streamAll();

      expect(result).toEqual({});
      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
    });

    it('should handle empty attachments array', async () => {
      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [],
        stream: mockStream
      });

      const result = await pool.streamAll();

      expect(result).toEqual({});
      expect(mockAdapter.processAttachment).not.toHaveBeenCalled();
      expect(console.log).toHaveBeenCalledWith(
        'Starting download of 0 attachments, streaming 10 at once.'
      );
    });

    it('should return delay when rate limit is hit', async () => {
      const delayResponse: ProcessAttachmentReturnType = { delay: 5000 };
      mockAdapter.processAttachment.mockResolvedValue(delayResponse);

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream
      });

      const result = await pool.streamAll();

      expect(result).toEqual({ delay: 5000 });
    });
  });

  describe('startPoolStreaming', () => {
    it('should skip already processed attachments', async () => {
      mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList = ['attachment-1'];
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream
      });

      await pool.streamAll();

      expect(console.log).toHaveBeenCalledWith(
        'Attachment with ID attachment-1 has already been processed. Skipping.'
      );
      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(2); // Only 2 out of 3
    });

    it('should add successfully processed attachment IDs to the list', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        stream: mockStream
      });

      await pool.streamAll();

      expect(mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList).toEqual([
        'attachment-1',
        'attachment-2',
        'attachment-3'
      ]);

      expect(console.log).toHaveBeenCalledWith('Successfully processed attachment: attachment-1');
      expect(console.log).toHaveBeenCalledWith('Successfully processed attachment: attachment-2');
      expect(console.log).toHaveBeenCalledWith('Successfully processed attachment: attachment-3');
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
        stream: mockStream
      });

      await pool.streamAll();

      expect(console.warn).toHaveBeenCalledWith(
        'Skipping attachment with ID attachment-2 due to error: Error: Processing failed'
      );
      expect(mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList).toEqual([
        'attachment-1',
        'attachment-3'
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
        stream: mockStream
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
      expect(mockAdapter.state.toDevRev!.attachmentsMetadata.lastProcessedAttachmentsIdsList).toEqual([
        'attachment-1',
        'attachment-3'
      ]);
    });

    it('should pass correct parameters to processAttachment', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        stream: mockStream
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledWith(
        mockAttachments[0],
        mockStream
      );
    });
  });

  describe('edge cases', () => {
    it('should handle single attachment', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: [mockAttachments[0]],
        stream: mockStream
      });

      const result = await pool.streamAll();

      expect(result).toEqual({});
      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(1);
    });

    it('should handle batch size larger than attachments array', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        batchSize: 100,
        stream: mockStream
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
    });

    it('should handle batch size of 1', async () => {
      mockAdapter.processAttachment.mockResolvedValue({});

      const pool = new AttachmentsStreamingPool({
        adapter: mockAdapter,
        attachments: mockAttachments,
        batchSize: 1,
        stream: mockStream
      });

      await pool.streamAll();

      expect(mockAdapter.processAttachment).toHaveBeenCalledTimes(3);
    });
  });

  describe('concurrency behavior', () => {
    it('should process attachments concurrently within batch size', async () => {
      let processCallCount = 0;
      const processPromises: Promise<ProcessAttachmentReturnType>[] = [];

      mockAdapter.processAttachment.mockImplementation(() => {
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
        stream: mockStream
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
