import fs from 'fs';
import { jsonl } from 'js-jsonl';
import zlib from 'zlib';

import {
  MAX_DEVREV_FILENAME_EXTENSION_LENGTH,
  MAX_DEVREV_FILENAME_LENGTH,
} from '../common/constants';
import {
  compressGzip,
  decompressGzip,
  downloadToLocal,
  parseJsonl,
  truncateFilename,
} from './uploader.helpers';

describe('uploader.helpers', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  describe(compressGzip.name, () => {
    it('should compress a string to gzip buffer', () => {
      // Arrange
      const input = '{"id":1}\n{"id":2}';

      // Act
      const result = compressGzip(input);

      // Assert
      expect(result).toBeInstanceOf(Buffer);
      const decompressed = zlib.gunzipSync(result as Buffer).toString();
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
      expect(result).toBeUndefined();

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
      expect(result).toBe(originalString);
    });

    it('[edge] should return undefined and log error when decompression fails', () => {
      // Arrange
      const invalidGzip = Buffer.from('not valid gzip data');

      // Act
      const result = decompressGzip(invalidGzip);

      // Assert
      expect(result).toBeUndefined();
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
      expect(result).toEqual(data);
    });

    it('[edge] should return null and log error when parsing fails', () => {
      // Arrange
      const invalidJsonl = 'not valid jsonl {{{';

      // Act
      const result = parseJsonl(invalidJsonl);

      // Assert
      expect(result).toBeNull();
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
      };
      const fsPromisesOpenSpy = jest
        .spyOn(require('fs').promises, 'open')
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
      };
      const fsPromisesOpenSpy = jest
        .spyOn(require('fs').promises, 'open')
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
      };
      const fsPromisesOpenSpy = jest
        .spyOn(require('fs').promises, 'open')
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
      };
      const fsPromisesOpenSpy = jest
        .spyOn(require('fs').promises, 'open')
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
        .spyOn(require('fs').promises, 'open')
        .mockRejectedValueOnce(fileError);

      // Act & Assert
      await expect(downloadToLocal(itemType, fetchedObjects)).rejects.toThrow(
        fileError
      );

      fsPromisesOpenSpy.mockRestore();
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
