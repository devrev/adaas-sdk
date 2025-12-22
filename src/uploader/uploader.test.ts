import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { jsonl } from 'js-jsonl';
import { Readable } from 'stream';
import zlib from 'zlib';

import { axiosClient } from '../http/axios-client-internal';
import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types';
import { downloadToLocal } from './uploader.helpers';
import { ArtifactToUpload } from './uploader.interfaces';
import { Uploader } from './uploader';

jest.mock('../http/axios-client-internal', () => {
  const originalModule = jest.requireActual('../http/axios-client-internal');
  return {
    ...originalModule,
    axiosClient: {
      get: jest.fn(),
      post: jest.fn(),
    },
  };
});

jest.mock('./uploader.helpers', () => {
  const originalModule = jest.requireActual('./uploader.helpers');
  return {
    ...originalModule,
    downloadToLocal: jest.fn(),
  };
});

const createMockArtifact = (
  overrides: Partial<ArtifactToUpload> = {}
): ArtifactToUpload => ({
  artifact_id: 'art_123',
  upload_url: 'https://s3.example.com/upload',
  form_data: [],
  ...overrides,
});

const createMockSuccessResponse = (
  overrides: Partial<AxiosResponse> = {}
): AxiosResponse =>
  ({
    status: 200,
    data: { success: true },
    statusText: 'OK',
    headers: {},
    config: {},
    ...overrides,
  } as AxiosResponse);

const mockDownloadUrlResponse = () => ({
  data: { download_url: 'https://s3.example.com/download' },
});

describe(Uploader.name, () => {
  const mockEvent = createEvent({ eventType: EventType.StartExtractingData });

  let uploader: Uploader;
  let consoleErrorSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    uploader = new Uploader({ event: mockEvent });
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe(Uploader.prototype.upload.name, () => {
    const mockArtifactUploadUrlResponse = {
      data: createMockArtifact(),
    };

    it('should compress, upload, confirm and return artifact info on success', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [
        { id: 1, name: 'Task 1' },
        { id: 2, name: 'Task 2' },
      ];

      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      (axiosClient.post as jest.Mock).mockResolvedValue(
        createMockSuccessResponse()
      );

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result).toEqual({
        artifact: {
          id: 'art_123',
          item_type: itemType,
          item_count: 2,
        },
      });
      expect(result.error).toBeUndefined();
    });

    it('should handle single object and report item_count as 1', async () => {
      // Arrange
      const itemType = 'metadata';
      const fetchedObject = { key: 'value' };

      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      (axiosClient.post as jest.Mock).mockResolvedValue(
        createMockSuccessResponse()
      );

      // Act
      const result = await uploader.upload(itemType, fetchedObject);

      // Assert
      expect(result.artifact?.item_count).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('[edge] should return error when getArtifactUploadUrl fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      (axiosClient.get as jest.Mock).mockRejectedValueOnce(
        new Error('API error')
      );

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(
        'Error while getting artifact upload URL.'
      );
      expect(result.artifact).toBeUndefined();
    });

    it('[edge] should return error when uploadArtifact fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      (axiosClient.post as jest.Mock).mockRejectedValueOnce(
        new Error('Upload error')
      );

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Error while uploading artifact.');
      expect(result.artifact).toBeUndefined();
    });

    it('[edge] should return error when confirmArtifactUpload fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      (axiosClient.post as jest.Mock)
        .mockResolvedValueOnce(createMockSuccessResponse())
        .mockRejectedValueOnce(new Error('Confirm error'));

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(
        'Error while confirming artifact upload.'
      );
      expect(result.artifact).toBeUndefined();
    });

    it('[edge] should return error when compression fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];
      const uploaderHelpers = require('./uploader.helpers');
      const compressGzipSpy = jest
        .spyOn(uploaderHelpers, 'compressGzip')
        .mockReturnValueOnce(undefined);

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(
        'Error while compressing jsonl object.'
      );
      expect(result.artifact).toBeUndefined();

      compressGzipSpy.mockRestore();
    });

    it('should call downloadToLocal when isLocalDevelopment is true', async () => {
      // Arrange
      const localUploader = new Uploader({
        event: mockEvent,
        options: { isLocalDevelopment: true },
      });
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      (axiosClient.post as jest.Mock).mockResolvedValue(
        createMockSuccessResponse()
      );

      // Act
      await localUploader.upload(itemType, fetchedObjects);

      // Assert
      expect(downloadToLocal).toHaveBeenCalledWith(itemType, fetchedObjects);
    });
  });

  describe(Uploader.prototype.getArtifactUploadUrl.name, () => {
    it('should return artifact upload info when API call succeeds', async () => {
      // Arrange
      const filename = 'test-file.jsonl.gz';
      const fileType = 'application/x-gzip';
      const fileSize = 1024;
      const expectedArtifact: ArtifactToUpload = {
        artifact_id: 'art_123',
        upload_url: 'https://s3.example.com/upload',
        form_data: [],
      };

      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: expectedArtifact,
      });

      // Act
      const result = await uploader.getArtifactUploadUrl(
        filename,
        fileType,
        fileSize
      );

      // Assert
      expect(result).toEqual(expectedArtifact);
      expect(axiosClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/internal/airdrop.artifacts.upload-url'),
        expect.objectContaining({
          params: expect.objectContaining({
            file_type: fileType,
            file_name: filename,
            file_size: fileSize,
          }),
        })
      );
    });

    it('should return undefined when API call fails', async () => {
      // Arrange
      const filename = 'test-file.jsonl.gz';
      const fileType = 'application/x-gzip';

      (axiosClient.get as jest.Mock).mockRejectedValueOnce(
        new Error('API call failed')
      );

      // Act
      const result = await uploader.getArtifactUploadUrl(filename, fileType);

      // Assert
      expect(result).toBeUndefined();
      expect(axiosClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/internal/airdrop.artifacts.upload-url'),
        expect.objectContaining({
          params: expect.objectContaining({
            file_type: fileType,
            file_name: filename,
          }),
        })
      );
    });
  });

  describe(Uploader.prototype.uploadArtifact.name, () => {
    it('should post file as multipart form data and return response on success', async () => {
      // Arrange
      const artifact = createMockArtifact();
      const file = Buffer.from('test file content');
      const mockResponse = createMockSuccessResponse();

      (axiosClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      // Act
      const result = await uploader.uploadArtifact(artifact, file);

      // Assert
      expect(result).toBe(mockResponse);
      expect(axiosClient.post).toHaveBeenCalledWith(
        artifact.upload_url,
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
    });

    it('should append form_data fields to the multipart form', async () => {
      // Arrange
      // form_data is typed as array but implementation iterates with for...in
      const formDataFields = { key: 'test-key', 'x-amz-credential': 'cred123' };
      const artifact = {
        artifact_id: 'art_123',
        upload_url: 'https://s3.example.com/upload',
        form_data: formDataFields,
      } as unknown as ArtifactToUpload;
      const file = Buffer.from('test file content');
      const appendSpy = jest.spyOn(FormData.prototype, 'append');

      (axiosClient.post as jest.Mock).mockResolvedValueOnce({ status: 200 });

      // Act
      await uploader.uploadArtifact(artifact, file);

      // Assert
      expect(appendSpy).toHaveBeenCalledWith('key', 'test-key');
      expect(appendSpy).toHaveBeenCalledWith('x-amz-credential', 'cred123');
      expect(appendSpy).toHaveBeenCalledWith('file', file);

      appendSpy.mockRestore();
    });

    it('[edge] should return undefined when upload fails', async () => {
      // Arrange
      const artifact = createMockArtifact();
      const file = Buffer.from('test file content');

      (axiosClient.post as jest.Mock).mockRejectedValueOnce(
        new Error('Upload failed')
      );

      // Act
      const result = await uploader.uploadArtifact(artifact, file);

      // Assert
      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error while uploading artifact.',
        expect.anything()
      );
    });
  });

  describe(Uploader.prototype.confirmArtifactUpload.name, () => {
    it('should confirm artifact upload and return response on success', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockResponse = createMockSuccessResponse();

      (axiosClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      // Act
      const result = await uploader.confirmArtifactUpload(artifactId);

      // Assert
      expect(result).toBe(mockResponse);
      expect(axiosClient.post).toHaveBeenCalledWith(
        expect.stringContaining('/internal/airdrop.artifacts.confirm-upload'),
        expect.objectContaining({
          request_id: expect.any(String),
          artifact_id: artifactId,
        }),
        expect.objectContaining({
          headers: expect.any(Object),
        })
      );
    });

    it('[edge] should return undefined when confirmation fails', async () => {
      // Arrange
      const artifactId = 'art_123';

      (axiosClient.post as jest.Mock).mockRejectedValueOnce(
        new Error('Confirmation failed')
      );

      // Act
      const result = await uploader.confirmArtifactUpload(artifactId);

      // Assert
      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error while confirming artifact upload.',
        expect.anything()
      );
    });
  });

  describe(Uploader.prototype.streamArtifact.name, () => {
    const createMockFileStream = (
      options: { contentLength?: string; destroyFn?: jest.Mock } = {}
    ): AxiosResponse => {
      const { contentLength, destroyFn = jest.fn() } = options;
      const readable = new Readable({
        read() {
          this.push('test data');
          this.push(null);
        },
      });
      readable.destroy = destroyFn;

      return {
        data: readable,
        headers: contentLength ? { 'content-length': contentLength } : {},
        status: 200,
        statusText: 'OK',
        config: {},
      } as unknown as AxiosResponse;
    };

    it('should stream file data to upload URL and return response on success', async () => {
      // Arrange
      const artifact = createMockArtifact();
      const destroyFn = jest.fn();
      const fileStream = createMockFileStream({
        contentLength: '1024',
        destroyFn,
      });
      const mockResponse = createMockSuccessResponse();

      (axiosClient.post as jest.Mock).mockResolvedValueOnce(mockResponse);

      // Act
      const result = await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(result).toBe(mockResponse);
      expect(axiosClient.post).toHaveBeenCalledWith(
        artifact.upload_url,
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.any(Object),
          maxRedirects: 0,
          validateStatus: expect.any(Function),
        })
      );
      expect(destroyFn).toHaveBeenCalled();
    });

    it('should append form_data fields to the multipart form', async () => {
      // Arrange
      const formDataFields = { key: 'test-key', 'x-amz-credential': 'cred123' };
      const artifact = {
        artifact_id: 'art_123',
        upload_url: 'https://s3.example.com/upload',
        form_data: formDataFields,
      } as unknown as ArtifactToUpload;
      const fileStream = createMockFileStream({ contentLength: '1024' });
      const appendSpy = jest.spyOn(FormData.prototype, 'append');

      (axiosClient.post as jest.Mock).mockResolvedValueOnce({ status: 200 });

      // Act
      await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(appendSpy).toHaveBeenCalledWith('key', 'test-key');
      expect(appendSpy).toHaveBeenCalledWith('x-amz-credential', 'cred123');

      appendSpy.mockRestore();
    });

    it('should use validateStatus that accepts 2xx and 3xx status codes', async () => {
      // Arrange
      const artifact = createMockArtifact();
      const fileStream = createMockFileStream({ contentLength: '1024' });

      (axiosClient.post as jest.Mock).mockResolvedValueOnce(
        createMockSuccessResponse()
      );

      // Act
      await uploader.streamArtifact(artifact, fileStream);

      // Assert
      const callArgs = (axiosClient.post as jest.Mock).mock.calls[0];
      const config = callArgs[2];
      const validateStatus = config.validateStatus;

      expect(validateStatus(200)).toBe(true);
      expect(validateStatus(201)).toBe(true);
      expect(validateStatus(299)).toBe(true);
      expect(validateStatus(300)).toBe(true);
      expect(validateStatus(301)).toBe(true);
      expect(validateStatus(399)).toBe(true);
      expect(validateStatus(400)).toBe(false);
      expect(validateStatus(404)).toBe(false);
      expect(validateStatus(500)).toBe(false);
      expect(validateStatus(199)).toBe(false);
    });

    it('should set Content-Length header when missing from file stream', async () => {
      // Arrange
      const artifact = createMockArtifact();
      const fileStream = createMockFileStream();

      (axiosClient.post as jest.Mock).mockResolvedValueOnce(
        createMockSuccessResponse()
      );

      // Act
      await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(axiosClient.post).toHaveBeenCalledWith(
        artifact.upload_url,
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Length': expect.any(Number),
          }),
        })
      );
    });

    it('[edge] should destroy stream and return undefined when streaming fails', async () => {
      // Arrange
      const artifact = createMockArtifact();
      const destroyFn = jest.fn();
      const fileStream = createMockFileStream({ destroyFn });

      (axiosClient.post as jest.Mock).mockRejectedValueOnce(
        new Error('Streaming failed')
      );

      // Act
      const result = await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(result).toBeUndefined();
      expect(destroyFn).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error while streaming artifact.',
        expect.anything()
      );
    });
  });

  describe('destroyStream', () => {
    const callDestroyStream = (
      uploaderInstance: Uploader,
      fileStream: AxiosResponse
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (uploaderInstance as any)['destroyStream'](fileStream);
    };

    it('should call destroy when stream has destroy method', () => {
      // Arrange
      const destroyFn = jest.fn();
      const fileStream = {
        data: { destroy: destroyFn },
      } as unknown as AxiosResponse;

      // Act
      callDestroyStream(uploader, fileStream);

      // Assert
      expect(destroyFn).toHaveBeenCalled();
    });

    it('should call close when stream has close but no destroy method', () => {
      // Arrange
      const closeFn = jest.fn();
      const fileStream = {
        data: { close: closeFn },
      } as unknown as AxiosResponse;

      // Act
      callDestroyStream(uploader, fileStream);

      // Assert
      expect(closeFn).toHaveBeenCalled();
    });

    it('should prefer destroy over close when both are available', () => {
      // Arrange
      const destroyFn = jest.fn();
      const closeFn = jest.fn();
      const fileStream = {
        data: { destroy: destroyFn, close: closeFn },
      } as unknown as AxiosResponse;

      // Act
      callDestroyStream(uploader, fileStream);

      // Assert
      expect(destroyFn).toHaveBeenCalled();
      expect(closeFn).not.toHaveBeenCalled();
    });

    it('[edge] should handle stream with no destroy or close methods', () => {
      // Arrange
      const fileStream = {
        data: {},
      } as unknown as AxiosResponse;

      // Act & Assert - should not throw
      expect(() => callDestroyStream(uploader, fileStream)).not.toThrow();
    });

    it('[edge] should handle null/undefined data gracefully', () => {
      // Arrange
      const fileStreamNullData = {
        data: null,
      } as unknown as AxiosResponse;

      const fileStreamUndefinedData = {
        data: undefined,
      } as unknown as AxiosResponse;

      // Act & Assert - should not throw
      expect(() =>
        callDestroyStream(uploader, fileStreamNullData)
      ).not.toThrow();
      expect(() =>
        callDestroyStream(uploader, fileStreamUndefinedData)
      ).not.toThrow();
    });

    it('[edge] should warn when destroy throws an error', () => {
      // Arrange
      const destroyFn = jest.fn().mockImplementation(() => {
        throw new Error('Destroy failed');
      });
      const fileStream = {
        data: { destroy: destroyFn },
      } as unknown as AxiosResponse;

      // Act
      callDestroyStream(uploader, fileStream);

      // Assert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Error while destroying stream:',
        expect.anything()
      );
    });
  });

  describe('getArtifactDownloadUrl', () => {
    const callGetArtifactDownloadUrl = (
      uploaderInstance: Uploader,
      artifactId: string
    ) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (uploaderInstance as any)['getArtifactDownloadUrl'](artifactId);
    };

    it('should return download URL when API call succeeds', async () => {
      // Arrange
      const artifactId = 'art_123';
      const expectedDownloadUrl = 'https://s3.example.com/download/art_123';

      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: { download_url: expectedDownloadUrl },
      });

      // Act
      const result = await callGetArtifactDownloadUrl(uploader, artifactId);

      // Assert
      expect(result).toBe(expectedDownloadUrl);
      expect(axiosClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/internal/airdrop.artifacts.download-url'),
        expect.objectContaining({
          params: expect.objectContaining({
            artifact_id: artifactId,
            request_id: expect.any(String),
          }),
        })
      );
    });

    it('[edge] should return undefined when API call fails', async () => {
      // Arrange
      const artifactId = 'art_123';

      (axiosClient.get as jest.Mock).mockRejectedValueOnce(
        new Error('API error')
      );

      // Act
      const result = await callGetArtifactDownloadUrl(uploader, artifactId);

      // Assert
      expect(result).toBeUndefined();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error while getting artifact download URL.',
        expect.anything()
      );
    });
  });

  describe(Uploader.prototype.getAttachmentsFromArtifactId.name, () => {
    it('should download, decompress, parse and return attachments on success', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockAttachments = [
        { id: '1', url: 'https://example.com/1', file_name: 'file1.txt' },
        { id: '2', url: 'https://example.com/2', file_name: 'file2.txt' },
      ];
      const gzippedData = zlib.gzipSync(jsonl.stringify(mockAttachments));
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );

      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: gzippedData,
      });

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.attachments).toEqual(mockAttachments);
      expect(result.error).toBeUndefined();
    });

    it('[edge] should return error when getArtifactDownloadUrl fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest
        .spyOn(uploader as any, 'getArtifactDownloadUrl')
        .mockResolvedValueOnce(undefined);

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(
        'Error while getting artifact download URL.'
      );
      expect(result.attachments).toBeUndefined();
    });

    it('[edge] should return error when downloadArtifact fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );
      (axiosClient.get as jest.Mock).mockRejectedValueOnce(
        new Error('Download error')
      );

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(
        'Error while downloading gzipped jsonl object.'
      );
      expect(result.attachments).toBeUndefined();
    });

    it('[edge] should return error when decompression fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );
      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: Buffer.from('not valid gzip data'),
      });

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe(
        'Error while decompressing gzipped jsonl object.'
      );
      expect(result.attachments).toBeUndefined();
    });

    it('[edge] should return error when JSONL parsing fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      const gzippedInvalidJsonl = zlib.gzipSync('not valid jsonl {{{');
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );
      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: gzippedInvalidJsonl,
      });

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.error?.message).toBe('Error while parsing jsonl object.');
      expect(result.attachments).toBeUndefined();
    });
  });

  describe(Uploader.prototype.getJsonObjectByArtifactId.name, () => {
    it('should download and parse non-gzipped artifact', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const jsonlData = jsonl.stringify(mockData);
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );
      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: Buffer.from(jsonlData),
      });

      // Act
      const result = await uploader.getJsonObjectByArtifactId({
        artifactId,
        isGzipped: false,
      });

      // Assert
      expect(result).toEqual(mockData);
    });

    it('should download, decompress and parse gzipped artifact', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const gzippedData = zlib.gzipSync(jsonl.stringify(mockData));
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );
      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: gzippedData,
      });

      // Act
      const result = await uploader.getJsonObjectByArtifactId({
        artifactId,
        isGzipped: true,
      });

      // Assert
      expect(result).toEqual(mockData);
    });

    it('[edge] should return undefined when getArtifactDownloadUrl fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      jest
        .spyOn(uploader as any, 'getArtifactDownloadUrl')
        .mockResolvedValueOnce(undefined);

      // Act
      const result = await uploader.getJsonObjectByArtifactId({ artifactId });

      // Assert
      expect(result).toBeUndefined();
    });

    it('[edge] should return undefined when downloadArtifact fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );
      (axiosClient.get as jest.Mock).mockRejectedValueOnce(
        new Error('Download error')
      );

      // Act
      const result = await uploader.getJsonObjectByArtifactId({ artifactId });

      // Assert
      expect(result).toBeUndefined();
    });

    it('[edge] should return undefined when decompression fails for gzipped artifact', async () => {
      // Arrange
      const artifactId = 'art_123';
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        mockDownloadUrlResponse()
      );
      (axiosClient.get as jest.Mock).mockResolvedValueOnce({
        data: Buffer.from('not valid gzip'),
      });

      // Act
      const result = await uploader.getJsonObjectByArtifactId({
        artifactId,
        isGzipped: true,
      });

      // Assert
      expect(result).toBeUndefined();
    });
  });
});
