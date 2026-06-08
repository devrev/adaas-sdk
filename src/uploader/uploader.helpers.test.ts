import fs, { promises as fsPromises } from 'fs';
import type { FileHandle } from 'fs/promises';
import { jsonl } from 'js-jsonl';
import zlib from 'zlib';

import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from '../common/constants';
import {
  compressGzip,
  computeArtifactDateRanges,
  decompressGzip,
  downloadToLocal,
  parseJsonl,
  truncateFilename,
} from './uploader.helpers';

describe('uploader.helpers', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe(compressGzip.name, () => {
    it('should compress a string to gzip buffer', () => {
      // Arrange
      const input = '{"id":1}\n{"id":2}';

      // Act
      const result = compressGzip(input);

      // Assert
      expect(result.response!).toBeInstanceOf(Buffer);
      const decompressed = zlib
        .gunzipSync(result.response! as Buffer)
        .toString();
      expect(decompressed).toBe(input);
    });

    it('[edge] should return undefined and log error when compression fails', () => {
      // Arrange
      const gzipSyncSpy = jest
        .spyOn(zlib, 'gzipSync')
        .mockImplementationOnce(() => {
          throw new Error('Compression failed');
        });

      // Act
      const result = compressGzip('test data');

      // Assert
      expect(result.response).toBeUndefined();

      gzipSyncSpy.mockRestore();
    });
  });

  describe(decompressGzip.name, () => {
    it('should decompress a gzip buffer to string', () => {
      // Arrange
      const originalString = '{"id":1}\n{"id":2}';
      const compressed = zlib.gzipSync(originalString);

      // Act
      const result = decompressGzip(compressed);

      // Assert
      expect(result.response!).toBe(originalString);
    });

    it('[edge] should return undefined and log error when decompression fails', () => {
      // Arrange
      const invalidGzip = Buffer.from('not valid gzip data');

      // Act
      const result = decompressGzip(invalidGzip);

      // Assert
      expect(result.response).toBeUndefined();
    });
  });

  describe(parseJsonl.name, () => {
    it('should parse valid JSONL string to array of objects', () => {
      // Arrange
      const data = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ];
      const jsonlString = jsonl.stringify(data);

      // Act
      const result = parseJsonl(jsonlString);

      // Assert
      expect(result.response!).toEqual(data);
    });

    it('[edge] should return null and log error when parsing fails', () => {
      // Arrange
      const invalidJsonl = 'not valid jsonl {{{';

      // Act
      const result = parseJsonl(invalidJsonl);

      // Assert
      expect(result.response).toBeUndefined();
    });
  });

  describe(downloadToLocal.name, () => {
    const mockExistsSync = jest.spyOn(fs, 'existsSync');
    const mockMkdirSync = jest.spyOn(fs, 'mkdirSync');

    afterEach(() => {
      mockExistsSync.mockReset();
      mockMkdirSync.mockReset();
    });

    it('should create extracted_files directory if it does not exist', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];
      mockExistsSync.mockReturnValueOnce(false);
      mockMkdirSync.mockImplementationOnce(() => undefined);
      const mockFileHandle = {
        write: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as FileHandle;
      const fsPromisesOpenSpy = jest
        .spyOn(fsPromises, 'open')
        .mockResolvedValueOnce(mockFileHandle);

      // Act
      await downloadToLocal(itemType, fetchedObjects);

      // Assert
      expect(mockExistsSync).toHaveBeenCalledWith('extracted_files');
      expect(mockMkdirSync).toHaveBeenCalledWith('extracted_files');
      fsPromisesOpenSpy.mockRestore();
    });

    it('should write objects as JSONL lines to file', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }, { id: 2 }];
      mockExistsSync.mockReturnValueOnce(true);
      const mockFileHandle = {
        write: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as FileHandle;
      const fsPromisesOpenSpy = jest
        .spyOn(fsPromises, 'open')
        .mockResolvedValueOnce(mockFileHandle);

      // Act
      await downloadToLocal(itemType, fetchedObjects);

      // Assert
      expect(mockFileHandle.write).toHaveBeenCalledTimes(2);
      expect(mockFileHandle.write).toHaveBeenCalledWith('{"id":1}\n');
      expect(mockFileHandle.write).toHaveBeenCalledWith('{"id":2}\n');
      expect(mockFileHandle.close).toHaveBeenCalled();
      fsPromisesOpenSpy.mockRestore();
    });

    it('should handle single object (non-array) input', async () => {
      // Arrange
      const itemType = 'metadata';
      const fetchedObject = { key: 'value' };
      mockExistsSync.mockReturnValueOnce(true);
      const mockFileHandle = {
        write: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as FileHandle;
      const fsPromisesOpenSpy = jest
        .spyOn(fsPromises, 'open')
        .mockResolvedValueOnce(mockFileHandle);

      // Act
      await downloadToLocal(itemType, fetchedObject);

      // Assert
      expect(mockFileHandle.write).toHaveBeenCalledTimes(1);
      expect(mockFileHandle.write).toHaveBeenCalledWith('{"key":"value"}\n');
      fsPromisesOpenSpy.mockRestore();
    });

    it('should use .json extension when itemType is external_domain_metadata', async () => {
      // Arrange
      const itemType = 'external_domain_metadata';
      const fetchedObject = { domain: 'example.com' };
      mockExistsSync.mockReturnValueOnce(true);
      const mockFileHandle = {
        write: jest.fn().mockResolvedValue(undefined),
        close: jest.fn().mockResolvedValue(undefined),
      } as unknown as FileHandle;
      const fsPromisesOpenSpy = jest
        .spyOn(fsPromises, 'open')
        .mockResolvedValueOnce(mockFileHandle);

      // Act
      await downloadToLocal(itemType, fetchedObject);

      // Assert
      expect(fsPromisesOpenSpy).toHaveBeenCalledWith(
        expect.stringMatching(/extractor_external_domain_metadata_\d+\.json$/),
        'w'
      );
      fsPromisesOpenSpy.mockRestore();
    });

    it('[edge] should reject and log error when file operations fail', async () => {
      // Arrange
      const itemType = 'tasks';
      const fetchedObjects = [{ id: 1 }];
      const fileError = new Error('File write failed');
      mockExistsSync.mockReturnValueOnce(true);
      const fsPromisesOpenSpy = jest
        .spyOn(fsPromises, 'open')
        .mockRejectedValueOnce(fileError);

      // Act & Assert
      await expect(downloadToLocal(itemType, fetchedObjects)).rejects.toThrow(
        fileError
      );

      fsPromisesOpenSpy.mockRestore();
    });
  });

  describe(computeArtifactDateRanges.name, () => {
    it('should compute min and max across multiple items', () => {
      // Arrange
      const items = [
        {
          id: '1',
          created_date: '2020-01-01T00:00:00.000Z',
          modified_date: '2021-06-01T00:00:00.000Z',
          data: {},
        },
        {
          id: '2',
          created_date: '2022-03-15T12:00:00.000Z',
          modified_date: '2020-12-31T23:59:59.000Z',
          data: {},
        },
      ];

      // Act
      const result = computeArtifactDateRanges(items);

      // Assert
      expect(result.oldest_created_date).toBe(
        '2020-01-01T00:00:00.000Z'
      );
      expect(result.newest_created_date).toBe(
        '2022-03-15T12:00:00.000Z'
      );
      expect(result.oldest_modified_date).toBe(
        '2020-12-31T23:59:59.000Z'
      );
      expect(result.newest_modified_date).toBe(
        '2021-06-01T00:00:00.000Z'
      );
    });

    it('should return zeros when no items have date fields', () => {
      // Arrange
      const items = [
        { id: 1, name: 'a' },
        { id: 2, name: 'b' },
      ];

      // Act
      const result = computeArtifactDateRanges(items);

      // Assert
      expect(result).toEqual({});
    });

    it('should aggregate only fields that are present on items', () => {
      // Arrange
      const items = [
        {
          id: '1',
          created_date: '2021-01-01T00:00:00.000Z',
          data: {},
        },
        {
          id: '2',
          modified_date: '2023-01-01T00:00:00.000Z',
          data: {},
        },
      ];

      // Act
      const result = computeArtifactDateRanges(items);

      // Assert
      expect(result.oldest_created_date).toBe(
        '2021-01-01T00:00:00.000Z'
      );
      expect(result.newest_created_date).toBe(
        '2021-01-01T00:00:00.000Z'
      );
      expect(result.oldest_modified_date).toBe(
        '2023-01-01T00:00:00.000Z'
      );
      expect(result.newest_modified_date).toBe(
        '2023-01-01T00:00:00.000Z'
      );
    });

    it('should handle single object input', () => {
      // Arrange
      const item = {
        id: '1',
        created_date: '2019-05-10T08:30:00.000Z',
        modified_date: '2019-05-10T08:30:00.000Z',
        data: {},
      };

      // Act
      const result = computeArtifactDateRanges(item);

      // Assert
      const ts = '2019-05-10T08:30:00.000Z';
      expect(result.oldest_created_date).toBe(ts);
      expect(result.newest_created_date).toBe(ts);
      expect(result.oldest_modified_date).toBe(ts);
      expect(result.newest_modified_date).toBe(ts);
    });

    it('should skip invalid date values', () => {
      const items = [
        {
          id: '1',
          created_date: 'not-a-date',
          modified_date: '2024-01-01T00:00:00.000Z',
          data: {},
        },
      ];

      const result = computeArtifactDateRanges(items);

      expect(result).toEqual({
        oldest_modified_date: '2024-01-01T00:00:00.000Z',
        newest_modified_date: '2024-01-01T00:00:00.000Z',
      });
    });

    it('[edge] should skip non-object entries in an array', () => {
      // Arrange
      const items = [
        null,
        {
          id: '1',
          created_date: '2024-01-01T00:00:00.000Z',
          modified_date: '2024-06-01T00:00:00.000Z',
          data: {},
        },
        'not-an-object',
      ] as unknown as object[];

      // Act
      const result = computeArtifactDateRanges(items);

      // Assert
      expect(result.oldest_created_date).toBe(
        '2024-01-01T00:00:00.000Z'
      );
      expect(result.newest_created_date).toBe(
        '2024-01-01T00:00:00.000Z'
      );
    });
  });

  describe(truncateFilename.name, () => {
    it('should return filename unchanged when within the limit', () => {
      // Arrange
      const filename = 'short-filename.txt';

      // Act
      const result = truncateFilename(filename);

      // Assert
      expect(result).toBe(filename);
    });

    it('should return filename unchanged when exactly at the limit', () => {
      // Arrange
      const filename = 'a'.repeat(MAX_DEVREV_FILENAME_LENGTH);

      // Act
      const result = truncateFilename(filename);

      // Assert
      expect(result).toBe(filename);
      expect(result.length).toBe(MAX_DEVREV_FILENAME_LENGTH);
    });

    it('should truncate filename and preserve extension when exceeding the limit', () => {
      // Arrange
      const longName = 'a'.repeat(300);
      const extension = '.txt';
      const filename = longName + extension;

      // Act
      const result = truncateFilename(filename);

      // Assert
      expect(result.length).toBe(MAX_DEVREV_FILENAME_LENGTH);
      expect(result).toContain('...');
      expect(result.endsWith(extension)).toBe(true);
    });

    it('should preserve the last MAX_DEVREV_FILENAME_EXTENSION_LENGTH characters as extension', () => {
      // Arrange
      const longName = 'document-'.repeat(50);
      const extension = '.verylongextension';
      const filename = longName + extension;

      // Act
      const result = truncateFilename(filename);

      // Assert
      expect(result.length).toBe(MAX_DEVREV_FILENAME_LENGTH);
      const expectedExtension = filename.slice(
        -MAX_DEVREV_FILENAME_EXTENSION_LENGTH
      );
      expect(result.endsWith(expectedExtension)).toBe(true);
    });

    it('should correctly format the truncated filename with ellipsis', () => {
      // Arrange
      const filename = 'x'.repeat(300) + '.pdf';

      // Act
      const result = truncateFilename(filename);

      // Assert
      const availableNameLength =
        MAX_DEVREV_FILENAME_LENGTH - MAX_DEVREV_FILENAME_EXTENSION_LENGTH - 3;
      const expectedPrefix = 'x'.repeat(availableNameLength);
      const expectedExtension = filename.slice(
        -MAX_DEVREV_FILENAME_EXTENSION_LENGTH
      );
      expect(result).toBe(`${expectedPrefix}...${expectedExtension}`);
    });

    it('[edge] should handle filename with no extension', () => {
      // Arrange
      const filename = 'a'.repeat(300);

      // Act
      const result = truncateFilename(filename);

      // Assert
      expect(result.length).toBe(MAX_DEVREV_FILENAME_LENGTH);
      expect(result).toContain('...');
      // Last 20 chars are preserved as "extension"
      expect(
        result.endsWith('a'.repeat(MAX_DEVREV_FILENAME_EXTENSION_LENGTH))
      ).toBe(true);
    });

    it('[edge] should handle filename that is just one character over the limit', () => {
      // Arrange
      const filename = 'a'.repeat(MAX_DEVREV_FILENAME_LENGTH + 1);

      // Act
      const result = truncateFilename(filename);

      // Assert
      expect(result.length).toBe(MAX_DEVREV_FILENAME_LENGTH);
    });
  });
});
