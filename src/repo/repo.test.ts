import { AirSyncDefaultItemTypes, SSOR_ATTACHMENT } from '../common/constants';
import { createItems, normalizeItem } from '../tests/test-helpers';
import { mockServer } from '../tests/jest.setup';
import { createMockEvent } from '../testing/mock-event';
import { EventType } from '../types';
import { Repo } from './repo';

jest.mock('../tests/test-helpers', () => ({
  ...jest.requireActual('../tests/test-helpers'),
  normalizeItem: jest.fn(),
}));

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
});
