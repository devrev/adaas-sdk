import { AxiosResponse } from 'axios';
import FormData from 'form-data';
import { jsonl } from 'js-jsonl';
import zlib from 'zlib';

import { axiosClient } from '../http/axios-client-internal';
import {
  callPrivateMethod,
  createArtifact,
  createAxiosResponse,
  createDownloadUrlResponse,
  createEvent,
  createFileBuffer,
  createFileStream,
  spyOnPrivateMethod,
} from '../tests/test-helpers';

import { compressGzip, downloadToLocal } from './uploader.helpers';
import { ArtifactToUpload, UploaderResult } from './uploader.interfaces';
import { Uploader } from './uploader';

jest.mock('../http/axios-client-internal');
jest.mock('./uploader.helpers', () => ({
  ...jest.requireActual('./uploader.helpers'),
  downloadToLocal: jest.fn(),
  compressGzip: jest.fn(jest.requireActual('./uploader.helpers').compressGzip),
}));

const mockedAxiosClient = jest.mocked(axiosClient);
const mockedDownloadToLocal = jest.mocked(downloadToLocal);
const mockedCompressGzip = jest.mocked(compressGzip);

/**
 * Type definition for private Uploader methods that need testing.
 * This provides type safety when testing private methods.
 */
type UploaderPrivateMethods = {
  destroyStream: (fileStream: AxiosResponse) => void;
  getArtifactDownloadUrl: (
    artifactId: string
  ) => Promise<UploaderResult<string>>;
};

describe(Uploader.name, () => {
  const mockEvent = createEvent();
  let uploader: Uploader;

  beforeEach(() => {
    uploader = new Uploader({ event: mockEvent });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe(Uploader.prototype.upload.name, () => {
    const mockArtifactUploadUrlResponse = {
      data: createArtifact(),
    };

    it('should return artifact info when upload flow succeeds', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [
        { id: 1, name: 'Task 1' },
        { id: 2, name: 'Task 2' },
      ];

      mockedAxiosClient.get.mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      mockedAxiosClient.post.mockResolvedValue(createAxiosResponse());

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

    it('should report item_count as 1 when uploading single object', async () => {
      // Arrange
      const itemType = 'metadata';
      const fetchedObject = { key: 'value' };

      mockedAxiosClient.get.mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      mockedAxiosClient.post.mockResolvedValue(createAxiosResponse());

      // Act
      const result = await uploader.upload(itemType, fetchedObject);

      // Assert
      expect(result.artifact?.item_count).toBe(1);
      expect(result.error).toBeUndefined();
    });

    it('should call downloadToLocal when isLocalDevelopment is true', async () => {
      // Arrange
      const localUploader = new Uploader({
        event: mockEvent,
        options: { isLocalDevelopment: true },
      });
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      mockedAxiosClient.get.mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      mockedAxiosClient.post.mockResolvedValue(createAxiosResponse());

      // Act
      await localUploader.upload(itemType, fetchedObjects);

      // Assert
      expect(mockedDownloadToLocal).toHaveBeenCalledWith(
        itemType,
        fetchedObjects
      );
    });

    it('should return error when getArtifactUploadUrl fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      mockedAxiosClient.get.mockRejectedValueOnce(
        new Error('Get artifact upload URL failed')
      );

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.artifact).toBeUndefined();
    });

    it('should return error when uploadArtifact fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      mockedAxiosClient.get.mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      mockedAxiosClient.post.mockRejectedValueOnce(
        new Error('Upload artifact failed')
      );

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.artifact).toBeUndefined();
    });

    it('should return error when confirmArtifactUpload fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];

      mockedAxiosClient.get.mockResolvedValueOnce(
        mockArtifactUploadUrlResponse
      );
      mockedAxiosClient.post
        .mockResolvedValueOnce(createAxiosResponse())
        .mockRejectedValueOnce(new Error('Confirm artifact upload failed'));

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.artifact).toBeUndefined();
    });

    it('should return error when compression fails', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];
      mockedCompressGzip.mockReturnValueOnce({ error: 'Mock error' });

      // Act
      const result = await uploader.upload(itemType, fetchedObjects);

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.artifact).toBeUndefined();
    });
  });

  describe(Uploader.prototype.getArtifactUploadUrl.name, () => {
    it('should return artifact upload info when API call succeeds', async () => {
      // Arrange
      const filename = 'test-file.jsonl.gz';
      const fileType = 'application/x-gzip';
      const fileSize = 1024;
      const expectedArtifact = createArtifact();

      mockedAxiosClient.get.mockResolvedValueOnce({
        data: expectedArtifact,
      });

      // Act
      const result = await uploader.getArtifactUploadUrl(
        filename,
        fileType,
        fileSize
      );

      // Assert
      expect(result.response).toEqual(expectedArtifact);
      expect(mockedAxiosClient.get).toHaveBeenCalledWith(
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

      mockedAxiosClient.get.mockRejectedValueOnce(
        new Error('Get artifact upload URL failed')
      );

      // Act
      const result = await uploader.getArtifactUploadUrl(filename, fileType);

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
      expect(mockedAxiosClient.get).toHaveBeenCalled();
    });

    it('should return error during upload, as it has size of zero', async () => {
      // Arrange
      const filename = 'test-file.jsonl.gz';
      const fileType = 'application/x-gzip';
      const fileSize = 0;

      // Act
      const result = await uploader.getArtifactUploadUrl(
        filename,
        fileType,
        fileSize
      );

      // Assert
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe(Uploader.prototype.uploadArtifact.name, () => {
    it('should return response when posting file as multipart form data', async () => {
      // Arrange
      const artifact = createArtifact();
      const file = createFileBuffer();
      const mockResponse = createAxiosResponse();

      mockedAxiosClient.post.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await uploader.uploadArtifact(artifact, file);

      // Assert
      expect(result.response).toBe(mockResponse);
      expect(mockedAxiosClient.post).toHaveBeenCalledWith(
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
      const file = createFileBuffer();
      const appendSpy = jest.spyOn(FormData.prototype, 'append');

      mockedAxiosClient.post.mockResolvedValueOnce({ status: 200 });

      // Act
      await uploader.uploadArtifact(artifact, file);

      // Assert
      expect(appendSpy).toHaveBeenCalledWith('key', 'test-key');
      expect(appendSpy).toHaveBeenCalledWith('x-amz-credential', 'cred123');
      expect(appendSpy).toHaveBeenCalledWith('file', file);

      appendSpy.mockRestore();
    });

    it('should return undefined when upload fails', async () => {
      // Arrange
      const artifact = createArtifact();
      const file = createFileBuffer();

      mockedAxiosClient.post.mockRejectedValueOnce(
        new Error('Upload artifact failed')
      );

      // Act
      const result = await uploader.uploadArtifact(artifact, file);

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe(Uploader.prototype.confirmArtifactUpload.name, () => {
    it('should return response when confirming artifact upload', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockResponse = createAxiosResponse();

      mockedAxiosClient.post.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await uploader.confirmArtifactUpload(artifactId);

      // Assert
      expect(result.response).toBe(mockResponse);
      expect(mockedAxiosClient.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          artifact_id: artifactId,
        }),
        expect.any(Object)
      );
    });

    it('should return undefined when confirmation fails', async () => {
      // Arrange
      const artifactId = 'art_123';

      mockedAxiosClient.post.mockRejectedValueOnce(
        new Error('Confirmation failed')
      );

      // Act
      const result = await uploader.confirmArtifactUpload(artifactId);

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe(Uploader.prototype.streamArtifact.name, () => {
    it('should return response when streaming file to upload URL', async () => {
      // Arrange
      const artifact = createArtifact();
      const destroyFn = jest.fn();
      const fileStream = createFileStream({
        contentLength: 1024,
        destroyFn,
      });
      const mockResponse = createAxiosResponse();

      mockedAxiosClient.post.mockResolvedValueOnce(mockResponse);

      // Act
      const result = await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(result.response).toBe(mockResponse);
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
      const fileStream = createFileStream({ contentLength: 1024 });
      const appendSpy = jest.spyOn(FormData.prototype, 'append');

      mockedAxiosClient.post.mockResolvedValueOnce({ status: 200 });

      // Act
      await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(appendSpy).toHaveBeenCalledWith('key', 'test-key');
      expect(appendSpy).toHaveBeenCalledWith('x-amz-credential', 'cred123');

      appendSpy.mockRestore();
    });

    it('should use validateStatus that accepts 2xx and 3xx status codes', async () => {
      // Arrange
      const artifact = createArtifact();
      const fileStream = createFileStream({ contentLength: 1024 });

      mockedAxiosClient.post.mockResolvedValueOnce(createAxiosResponse());

      // Act
      await uploader.streamArtifact(artifact, fileStream);

      // Assert
      const callArgs = mockedAxiosClient.post.mock.calls[0];
      const config = callArgs[2];
      const validateStatus = config?.validateStatus;

      expect(validateStatus?.(200)).toBe(true);
      expect(validateStatus?.(201)).toBe(true);
      expect(validateStatus?.(299)).toBe(true);
      expect(validateStatus?.(300)).toBe(true);
      expect(validateStatus?.(301)).toBe(true);
      expect(validateStatus?.(399)).toBe(true);
      expect(validateStatus?.(400)).toBe(false);
      expect(validateStatus?.(404)).toBe(false);
      expect(validateStatus?.(500)).toBe(false);
      expect(validateStatus?.(199)).toBe(false);
    });

    it('should set Content-Length header when missing from file stream', async () => {
      // Arrange
      const artifact = createArtifact();
      const fileStream = createFileStream({ includeContentLength: false });

      mockedAxiosClient.post.mockResolvedValueOnce(createAxiosResponse());

      // Act
      await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(mockedAxiosClient.post).toHaveBeenCalledWith(
        artifact.upload_url,
        expect.any(FormData),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Length': expect.any(Number),
          }),
        })
      );
    });

    it('should destroy stream and return undefined when streaming fails', async () => {
      // Arrange
      const artifact = createArtifact();
      const destroyFn = jest.fn();
      const fileStream = createFileStream({ destroyFn });

      mockedAxiosClient.post.mockRejectedValueOnce(
        new Error('Streaming failed')
      );

      // Act
      const result = await uploader.streamArtifact(artifact, fileStream);

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
      expect(destroyFn).toHaveBeenCalled();
    });
  });

  describe('Uploader.destroyStream', () => {
    it('should call destroy when stream has destroy method', () => {
      // Arrange
      const destroyStream = callPrivateMethod<UploaderPrivateMethods>()(
        uploader,
        'destroyStream'
      );
      const destroyFn = jest.fn();
      const fileStream = {
        data: { destroy: destroyFn },
      } as unknown as AxiosResponse;

      // Act
      destroyStream(fileStream);

      // Assert
      expect(destroyFn).toHaveBeenCalled();
    });

    it('should call close when stream has close but no destroy method', () => {
      // Arrange
      const destroyStream = callPrivateMethod<UploaderPrivateMethods>()(
        uploader,
        'destroyStream'
      );
      const closeFn = jest.fn();
      const fileStream = {
        data: { close: closeFn },
      } as unknown as AxiosResponse;

      // Act
      destroyStream(fileStream);

      // Assert
      expect(closeFn).toHaveBeenCalled();
    });

    it('should prefer destroy over close when both are available', () => {
      // Arrange
      const destroyStream = callPrivateMethod<UploaderPrivateMethods>()(
        uploader,
        'destroyStream'
      );
      const destroyFn = jest.fn();
      const closeFn = jest.fn();
      const fileStream = {
        data: { destroy: destroyFn, close: closeFn },
      } as unknown as AxiosResponse;

      // Act
      destroyStream(fileStream);

      // Assert
      expect(destroyFn).toHaveBeenCalled();
      expect(closeFn).not.toHaveBeenCalled();
    });

    it('[edge] should handle stream with no destroy or close methods', () => {
      // Arrange
      const destroyStream = callPrivateMethod<UploaderPrivateMethods>()(
        uploader,
        'destroyStream'
      );
      const fileStream = {
        data: {},
      } as unknown as AxiosResponse;

      // Act & Assert - should not throw
      expect(() => destroyStream(fileStream)).not.toThrow();
    });

    it('[edge] should handle null/undefined data gracefully', () => {
      // Arrange
      const destroyStream = callPrivateMethod<UploaderPrivateMethods>()(
        uploader,
        'destroyStream'
      );
      const fileStreamNullData = {
        data: null,
      } as unknown as AxiosResponse;

      const fileStreamUndefinedData = {
        data: undefined,
      } as unknown as AxiosResponse;

      // Act & Assert - should not throw
      expect(() => destroyStream(fileStreamNullData)).not.toThrow();
      expect(() => destroyStream(fileStreamUndefinedData)).not.toThrow();
    });

    it('[edge] should warn when destroy throws an error', () => {
      // Arrange
      const destroyStream = callPrivateMethod<UploaderPrivateMethods>()(
        uploader,
        'destroyStream'
      );
      const destroyFn = jest.fn().mockImplementation(() => {
        throw new Error('Destroy failed');
      });
      const fileStream = {
        data: { destroy: destroyFn },
      } as unknown as AxiosResponse;

      // Act & Assert - should not throw
      expect(() => destroyStream(fileStream)).not.toThrow();
    });
  });

  describe('Uploader.getArtifactDownloadUrl', () => {
    it('should return download URL when API call succeeds', async () => {
      // Arrange
      const getArtifactDownloadUrl =
        callPrivateMethod<UploaderPrivateMethods>()(
          uploader,
          'getArtifactDownloadUrl'
        );
      const artifactId = 'art_123';
      const expectedDownloadUrl = 'https://s3.example.com/download/art_123';

      mockedAxiosClient.get.mockResolvedValueOnce({
        data: { download_url: expectedDownloadUrl },
      });

      // Act
      const result = await getArtifactDownloadUrl(artifactId);

      // Assert
      expect(result.response).toBe(expectedDownloadUrl);
      expect(result.error).toBeUndefined();
      expect(mockedAxiosClient.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          params: expect.objectContaining({
            artifact_id: artifactId,
          }),
        })
      );
    });

    it('should return undefined when API call fails', async () => {
      // Arrange
      const getArtifactDownloadUrl =
        callPrivateMethod<UploaderPrivateMethods>()(
          uploader,
          'getArtifactDownloadUrl'
        );
      const artifactId = 'art_123';

      mockedAxiosClient.get.mockRejectedValueOnce(new Error('API error'));

      // Act
      const result = await getArtifactDownloadUrl(artifactId);

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
    });
  });

  describe(Uploader.prototype.getAttachmentsFromArtifactId.name, () => {
    it('should return attachments when download and parse succeeds', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockAttachments = [
        { id: '1', url: 'https://example.com/1', file_name: 'file1.txt' },
        { id: '2', url: 'https://example.com/2', file_name: 'file2.txt' },
      ];
      const gzippedData = zlib.gzipSync(jsonl.stringify(mockAttachments));
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());

      mockedAxiosClient.get.mockResolvedValueOnce({
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

    it('should return error when getArtifactDownloadUrl fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      spyOnPrivateMethod<UploaderPrivateMethods>(
        uploader,
        'getArtifactDownloadUrl'
      ).mockResolvedValueOnce({ error: new Error('API error') });

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.attachments).toBeUndefined();
    });

    it('should return error when downloadArtifact fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());
      mockedAxiosClient.get.mockRejectedValueOnce(new Error('Download error'));

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.attachments).toBeUndefined();
    });

    it('should return error when decompression fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());
      mockedAxiosClient.get.mockResolvedValueOnce({
        data: Buffer.from('not valid gzip data'),
      });

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.attachments).toBeUndefined();
    });

    it('should return error when JSONL parsing fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      const gzippedInvalidJsonl = zlib.gzipSync('not valid jsonl {{{');
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());
      mockedAxiosClient.get.mockResolvedValueOnce({
        data: gzippedInvalidJsonl,
      });

      // Act
      const result = await uploader.getAttachmentsFromArtifactId({
        artifact: artifactId,
      });

      // Assert
      expect(result.error).toBeInstanceOf(Error);
      expect(result.attachments).toBeUndefined();
    });
  });

  describe(Uploader.prototype.getJsonObjectByArtifactId.name, () => {
    it('should return parsed data when downloading non-gzipped artifact', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const jsonlData = jsonl.stringify(mockData);
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());
      mockedAxiosClient.get.mockResolvedValueOnce({
        data: Buffer.from(jsonlData),
      });

      // Act
      const result = await uploader.getJsonObjectByArtifactId({
        artifactId,
        isGzipped: false,
      });

      // Assert
      expect(result.response).toEqual(mockData);
    });

    it('should return parsed data when downloading gzipped artifact', async () => {
      // Arrange
      const artifactId = 'art_123';
      const mockData = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const gzippedData = zlib.gzipSync(jsonl.stringify(mockData));
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());
      mockedAxiosClient.get.mockResolvedValueOnce({
        data: gzippedData,
      });

      // Act
      const result = await uploader.getJsonObjectByArtifactId({
        artifactId,
        isGzipped: true,
      });

      // Assert
      expect(result.response).toEqual(mockData);
    });

    it('[edge] should return error when getArtifactDownloadUrl fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      spyOnPrivateMethod<UploaderPrivateMethods>(
        uploader,
        'getArtifactDownloadUrl'
      ).mockResolvedValueOnce({ error: new Error('API error') });

      // Act
      const result = await uploader.getJsonObjectByArtifactId({ artifactId });

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
    });

    it('[edge] should return error when downloadArtifact fails', async () => {
      // Arrange
      const artifactId = 'art_123';
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());
      mockedAxiosClient.get.mockRejectedValueOnce(new Error('Download error'));

      // Act
      const result = await uploader.getJsonObjectByArtifactId({ artifactId });

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeInstanceOf(Error);
    });

    it('[edge] should return error when decompression fails for gzipped artifact', async () => {
      // Arrange
      const artifactId = 'art_123';
      mockedAxiosClient.get.mockResolvedValueOnce(createDownloadUrlResponse());
      mockedAxiosClient.get.mockResolvedValueOnce({
        data: Buffer.from('not valid gzip'),
      });

      // Act
      const result = await uploader.getJsonObjectByArtifactId({
        artifactId,
        isGzipped: true,
      });

      // Assert
      expect(result.response).toBeUndefined();
      expect(result.error).toBeDefined();
    });
  });
});
