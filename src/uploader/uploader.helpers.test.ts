import fs from 'fs';
import { jsonl } from 'js-jsonl';
import zlib from 'zlib';

import {
  compressGzip,
  decompressGzip,
  downloadToLocal,
  parseJsonl,
} from './uploader.helpers';

describe('uploader.helpers', () => {
  let consoleErrorSpy: jest.SpyInstance;
  let consoleLogSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error while compressing jsonl object.',
        expect.any(Error)
      );

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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error while decompressing gzipped jsonl object.',
        expect.objectContaining({ message: expect.any(String) })
      );
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
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error while parsing jsonl object.',
        expect.any(Error)
      );
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

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error writing data to file.',
        fileError
      );
      fsPromisesOpenSpy.mockRestore();
    });
  });
});
