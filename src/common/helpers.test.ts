import { MAX_DEVREV_FILENAME_LENGTH, MAX_DEVREV_FILENAME_EXTENSION_LENGTH } from './constants';
import { truncateFilename } from './helpers';

describe('truncateFilename', () => {
  const originalWarn = console.warn; // Store original console.warn
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Mock console.warn to prevent test output pollution and to spy on calls
    warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original console.warn after each test
    warnSpy.mockRestore();
  });

  test('should return the original filename if it is within the length limit', () => {
    const filename = 'document.pdf';
    expect(truncateFilename(filename)).toBe(filename);
    expect(warnSpy).not.toHaveBeenCalled(); // No warning should be logged
  });

  test('should return the original filename if it is exactly at the length limit', () => {
    const filename = 'a'.repeat(MAX_DEVREV_FILENAME_LENGTH - 4) + '.txt';
    expect(truncateFilename(filename)).toBe(filename);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  test('should truncate the filename if it exceeds the limit', () => {
    const longFilename = 'a'.repeat(MAX_DEVREV_FILENAME_LENGTH) + '.txt';
    const availableNameLength = MAX_DEVREV_FILENAME_LENGTH - MAX_DEVREV_FILENAME_EXTENSION_LENGTH - 3;
    const expectedTruncatedPart = longFilename.slice(0, availableNameLength);
    const expectedExtension = longFilename.slice(-MAX_DEVREV_FILENAME_EXTENSION_LENGTH);
    const expectedResult = `${expectedTruncatedPart}...${expectedExtension}`;

    expect(truncateFilename(longFilename)).toBe(expectedResult);
    expect(warnSpy).toHaveBeenCalledTimes(1); // Warning should be logged
    expect(warnSpy).toHaveBeenCalledWith(
      `Filename length exceeds the maximum limit of ${MAX_DEVREV_FILENAME_LENGTH} characters. Truncating filename.`
    );
  });
});