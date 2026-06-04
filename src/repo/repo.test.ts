import { AirSyncDefaultItemTypes, SSOR_ATTACHMENT } from '../common/constants';
import { createItems, normalizeItem } from '../tests/test-helpers';
import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../common/test-utils';
import { EventType } from '../types';
import { NormalizedAttachment, NormalizedItem } from './repo.interfaces';
import { Uploader } from '../uploader/uploader';
import { Repo } from './repo';

jest.mock('../tests/test-helpers', () => ({
  ...jest.requireActual('../tests/test-helpers'),
  normalizeItem: jest.fn(),
}));

const mockUploadFn = jest.fn().mockResolvedValue({
  error: null,
  artifact: { id: 'art-1', item_type: 'test', item_count: 0 },
});

jest.mock('../uploader/uploader', () => ({
  Uploader: jest.fn().mockImplementation(() => ({
    upload: mockUploadFn,
  })),
}));

function itemWithDate(id: string, created_date: string): NormalizedItem {
  return { id, created_date, modified_date: created_date, data: {} };
}

function itemWithDates(
  id: string,
  created_date: string,
  modified_date: string
): NormalizedItem {
  return { id, created_date, modified_date, data: {} };
}

const ts = (iso: string) => new Date(iso).getTime();

describe(Repo.name, () => {
  let repo: Repo;
  let normalize: jest.Mock;

  beforeEach(() => {
    normalize = jest.fn();
    repo = new Repo({
      event: createMockEvent(mockServer.baseUrl, {
        payload: { event_type: EventType.ExtractionDataStart },
      }),
      itemType: 'test_item_type',
      normalize,
      onUpload: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should normalize and push items when array contains items', async () => {
    // Arrange
    const items = createItems(10);

    // Act
    await repo.push(items);

    // Assert
    expect(normalize).toHaveBeenCalledTimes(10);
    const normalizedItems = items.map((item) => normalizeItem(item));
    expect(repo.getItems()).toEqual(normalizedItems);
  });

  it('should not normalize items when normalize function is not provided', async () => {
    // Arrange
    repo = new Repo({
      event: createMockEvent(mockServer.baseUrl, {
        payload: { event_type: EventType.ExtractionDataStart },
      }),
      itemType: 'test_item_type',
      onUpload: jest.fn(),
      options: {},
    });
    const items = createItems(10);

    // Act
    await repo.push(items);

    // Assert
    expect(normalize).not.toHaveBeenCalled();
  });

  it('[edge] should not push items when items array is empty', async () => {
    // Act
    await repo.push([]);

    // Assert
    expect(repo.getItems()).toEqual([]);
  });

  it('should not normalize items when item type is external_domain_metadata', async () => {
    // Arrange
    repo = new Repo({
      event: createMockEvent(mockServer.baseUrl, {
        payload: { event_type: EventType.ExtractionDataStart },
      }),
      itemType: AirSyncDefaultItemTypes.EXTERNAL_DOMAIN_METADATA,
      normalize,
      onUpload: jest.fn(),
      options: {},
    });
    const items = createItems(10);

    // Act
    await repo.push(items);

    // Assert
    expect(normalize).not.toHaveBeenCalled();
  });

  it('should not normalize items when item type is ssor_attachment', async () => {
    // Arrange
    repo = new Repo({
      event: createMockEvent(mockServer.baseUrl, {
        payload: { event_type: EventType.ExtractionDataStart },
      }),
      itemType: SSOR_ATTACHMENT,
      normalize,
      onUpload: jest.fn(),
      options: {},
    });
    const items = createItems(10);

    // Act
    await repo.push(items);

    // Assert
    expect(normalize).not.toHaveBeenCalled();
  });

  it('should leave 5 items in the items array after pushing 2005 items with batch size of 2000', async () => {
    // Arrange
    const items = createItems(2005);

    // Act
    await repo.push(items);

    // Assert
    expect(repo.getItems().length).toBe(5);
  });

  it('should normalize all items when pushing 4005 items with batch size of 2000', async () => {
    // Arrange
    const items = createItems(4005);

    // Act
    await repo.push(items);

    // Assert
    expect(normalize).toHaveBeenCalledTimes(4005);
  });

  it('should upload 2 batches when pushing 4005 items with batch size of 2000', async () => {
    // Arrange
    const uploadSpy = jest.spyOn(repo, 'upload');
    const items = createItems(4005);

    // Act
    await repo.push(items);

    // Assert
    expect(uploadSpy).toHaveBeenCalledTimes(2);
    uploadSpy.mockRestore();
  });

  it('should leave 5 items in array after pushing 4005 items with batch size of 2000', async () => {
    // Arrange
    const items = createItems(4005);

    // Act
    await repo.push(items);

    // Assert
    expect(repo.getItems().length).toBe(5);
  });

  describe('should take batch size into account', () => {
    beforeEach(() => {
      repo = new Repo({
        event: createMockEvent(mockServer.baseUrl, {
          payload: { event_type: EventType.ExtractionDataStart },
        }),
        itemType: 'test_item_type',
        normalize,
        onUpload: jest.fn(),
        options: {
          batchSize: 50,
        },
      });
    });

    it('should empty the items array after pushing 50 items with batch size of 50', async () => {
      // Arrange
      const items = createItems(50);

      // Act
      await repo.push(items);

      // Assert
      expect(repo.getItems()).toEqual([]);
    });

    it('should leave 5 items in the items array after pushing 205 items with batch size of 50', async () => {
      // Arrange
      const items = createItems(205);

      // Act
      await repo.push(items);

      // Assert
      expect(repo.getItems().length).toBe(5);
    });

    it('should normalize all items when pushing 205 items with batch size of 50', async () => {
      // Arrange
      const items = createItems(205);

      // Act
      await repo.push(items);

      // Assert
      expect(normalize).toHaveBeenCalledTimes(205);
    });

    it('should upload 4 batches when pushing 205 items with batch size of 50', async () => {
      // Arrange
      const uploadSpy = jest.spyOn(repo, 'upload');
      const items = createItems(205);

      // Act
      await repo.push(items);

      // Assert
      expect(uploadSpy).toHaveBeenCalledTimes(4);
      uploadSpy.mockRestore();
    });

    it('should leave 5 items in array after pushing 205 items with batch size of 50', async () => {
      // Arrange
      const items = createItems(205);

      // Act
      await repo.push(items);

      // Assert
      expect(repo.getItems().length).toBe(5);
    });
  });

  describe('dateRanges', () => {
    beforeEach(() => {
      mockUploadFn.mockResolvedValue({
        error: null,
        artifact: { id: 'art-1', item_type: 'test', item_count: 0 },
      });
    });

    it('should track min and max created_date from a single upload batch', async () => {
      await repo.upload([
        itemWithDate('1', '2023-06-15T12:00:00.000Z'),
        itemWithDate('2', '2020-01-01T00:00:00.000Z'),
        itemWithDate('3', '2021-03-01T00:00:00.000Z'),
      ]);

      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2020-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2023-06-15T12:00:00.000Z')
      );
      expect(repo.dateRanges.modifiedDate.oldest).toBe(
        ts('2020-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.modifiedDate.newest).toBe(
        ts('2023-06-15T12:00:00.000Z')
      );
    });

    it('should skip items without created_date', async () => {
      const attachmentWithoutDate: NormalizedAttachment = {
        id: 'att-1',
        url: 'https://example.com/file',
        file_name: 'file.txt',
        parent_id: 'parent-1',
      };

      await repo.upload([
        itemWithDate('1', '2022-06-01T00:00:00.000Z'),
        { id: '2', created_date: null, modified_date: '', data: {} },
        { id: '3', modified_date: '', data: {} },
        attachmentWithoutDate,
      ]);

      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2022-06-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2022-06-01T00:00:00.000Z')
      );
    });

    it('should leave timestamps at zero when no items have created_date', async () => {
      await repo.upload([
        { id: '1', modified_date: '', data: {} },
        {
          id: 'att-1',
          url: 'https://example.com/file',
          file_name: 'file.txt',
          parent_id: 'parent-1',
        },
      ]);

      expect(repo.dateRanges).toEqual({
        creationDate: { oldest: 0, newest: 0 },
        modifiedDate: { oldest: 0, newest: 0 },
      });
    });

    it('should not update timestamps or call uploader on empty upload', async () => {
      await repo.upload([]);

      expect(repo.dateRanges).toEqual({
        creationDate: { oldest: 0, newest: 0 },
        modifiedDate: { oldest: 0, newest: 0 },
      });
      expect(mockUploadFn).not.toHaveBeenCalled();
    });

    it('should accumulate min and max across multiple upload batches via push', async () => {
      repo = new Repo({
        event: createMockEvent(mockServer.baseUrl, {
          payload: { event_type: EventType.ExtractionDataStart },
        }),
        itemType: 'test_item_type',
        onUpload: jest.fn(),
        options: { batchSize: 3 },
      });

      const dates = [
        '2020-01-01T00:00:00.000Z',
        '2021-01-01T00:00:00.000Z',
        '2022-01-01T00:00:00.000Z',
        '2023-01-01T00:00:00.000Z',
        '2024-06-01T00:00:00.000Z',
        '2024-12-01T00:00:00.000Z',
        '2024-12-31T00:00:00.000Z',
      ];
      const items = dates.map((created_date, index) =>
        itemWithDate(String(index), created_date)
      );

      await repo.push(items);

      expect(repo.getItems()).toHaveLength(1);
      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2020-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2024-12-01T00:00:00.000Z')
      );

      await repo.push([
        itemWithDate('7', '2019-01-01T00:00:00.000Z'),
        itemWithDate('8', '2025-01-01T00:00:00.000Z'),
      ]);

      expect(repo.getItems()).toHaveLength(0);
      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2019-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2025-01-01T00:00:00.000Z')
      );
    });

    it('should extend min and max when subsequent batches have wider date range', async () => {
      await repo.upload([
        itemWithDate('1', '2022-06-01T00:00:00.000Z'),
        itemWithDate('2', '2023-06-01T00:00:00.000Z'),
      ]);

      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2022-06-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2023-06-01T00:00:00.000Z')
      );

      await repo.upload([
        itemWithDate('3', '2020-01-01T00:00:00.000Z'),
        itemWithDate('4', '2024-01-01T00:00:00.000Z'),
      ]);

      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2020-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2024-01-01T00:00:00.000Z')
      );
    });

    it('should update timestamps even when upload fails', async () => {
      mockUploadFn.mockResolvedValueOnce({
        error: new Error('fail'),
        artifact: null,
      });

      await repo.upload([itemWithDate('1', '2022-01-01T00:00:00.000Z')]);

      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2022-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2022-01-01T00:00:00.000Z')
      );
    });

    it('should ignore invalid created_date and modified_date values', async () => {
      await repo.upload([
        {
          id: '1',
          created_date: 'not-a-date',
          modified_date: 'still-not-a-date',
          data: {},
        },
        itemWithDates(
          '2',
          '2022-01-01T00:00:00.000Z',
          '2023-01-01T00:00:00.000Z'
        ),
      ]);

      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2022-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2022-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.modifiedDate.oldest).toBe(
        ts('2023-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.modifiedDate.newest).toBe(
        ts('2023-01-01T00:00:00.000Z')
      );
    });

    it('should track modified_date independently from created_date', async () => {
      await repo.upload([
        itemWithDates(
          '1',
          '2020-01-01T00:00:00.000Z',
          '2023-01-01T00:00:00.000Z'
        ),
        itemWithDates(
          '2',
          '2024-01-01T00:00:00.000Z',
          '2021-06-01T00:00:00.000Z'
        ),
      ]);

      expect(repo.dateRanges.creationDate.oldest).toBe(
        ts('2020-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.creationDate.newest).toBe(
        ts('2024-01-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.modifiedDate.oldest).toBe(
        ts('2021-06-01T00:00:00.000Z')
      );
      expect(repo.dateRanges.modifiedDate.newest).toBe(
        ts('2023-01-01T00:00:00.000Z')
      );
    });
  });

  it('should throw when upload fails', async () => {
    jest.spyOn(Uploader.prototype, 'upload').mockResolvedValue({
      error: { message: 'upload failed' },
    });

    await expect(repo.upload(createItems(1))).rejects.toThrow('upload failed');
  });

  it('should retain items in repo when batch upload fails during push', async () => {
    repo = new Repo({
      event: createMockEvent(mockServer.baseUrl, {
        payload: { event_type: EventType.ExtractionDataStart },
      }),
      itemType: 'test_item_type',
      normalize,
      onUpload: jest.fn(),
      options: { batchSize: 10 },
    });

    const items = createItems(20);
    jest
      .spyOn(Uploader.prototype, 'upload')
      .mockResolvedValueOnce({
        artifact: {
          id: 'artifact-1',
          item_type: 'test_item_type',
          item_count: 10,
        },
      })
      .mockResolvedValueOnce({
        error: { message: 'second batch failed' },
      });

    await expect(repo.push(items)).rejects.toThrow('second batch failed');
    expect(repo.getItems().length).toBe(10);
  });
});
