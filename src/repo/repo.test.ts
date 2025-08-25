import { AIRDROP_DEFAULT_ITEM_TYPES } from '../common/constants';
import { createEvent, createItems, normalizeItem } from '../tests/test-helpers';
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
      event: createEvent({ eventType: EventType.ExtractionDataStart }),
      itemType: 'test_item_type',
      normalize,
      onUpload: jest.fn(),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should normalize and push items when array contains items', async () => {
    const items = createItems(10);
    await repo.push(items);
    expect(normalize).toHaveBeenCalledTimes(10);

    const normalizedItems = items.map((item) => normalizeItem(item));
    expect(repo.getItems()).toEqual(normalizedItems);
  });

  it('should not normalize items when normalize function is not provided', async () => {
    repo = new Repo({
      event: createEvent({ eventType: EventType.ExtractionDataStart }),
      itemType: 'test_item_type',
      onUpload: jest.fn(),
      options: {},
    });

    const items = createItems(10);
    await repo.push(items);
    expect(normalize).not.toHaveBeenCalled();
  });

  it('[edge] should not push items when items array is empty', async () => {
      await repo.push([]);
      expect(repo.getItems()).toEqual([]);
    });

  it('should not normalize items when item type is external_domain_metadata', async () => {
    repo = new Repo({
      event: createEvent({ eventType: EventType.ExtractionDataStart }),
      itemType: AIRDROP_DEFAULT_ITEM_TYPES.EXTERNAL_DOMAIN_METADATA,
      normalize,
      onUpload: jest.fn(),
      options: {},
    });

    const items = createItems(10);
    await repo.push(items);

    expect(normalize).not.toHaveBeenCalled();
  });

  it('should not normalize items when item type is ssor_attachment', async () => {
    repo = new Repo({
      event: createEvent({ eventType: EventType.ExtractionDataStart }),
      itemType: AIRDROP_DEFAULT_ITEM_TYPES.SSOR_ATTACHMENT,
      normalize,
      onUpload: jest.fn(),
      options: {},
    });

    const items = createItems(10);
    await repo.push(items);

    expect(normalize).not.toHaveBeenCalled();
  });

  it('should leave 5 items in the items array after pushing 2005 items with batch size of 2000', async () => {
    const items = createItems(2005);
    await repo.push(items);

    expect(repo.getItems().length).toBe(5);
  });

  it('should normalize all items when pushing 4005 items with batch size of 2000', async () => {
    const items = createItems(4005);
    await repo.push(items);

    expect(normalize).toHaveBeenCalledTimes(4005);
  });

  it('should upload 2 batches when pushing 4005 items with batch size of 2000', async () => {
    const uploadSpy = jest.spyOn(repo, 'upload');

    const items = createItems(4005);
    await repo.push(items);

    expect(uploadSpy).toHaveBeenCalledTimes(2);
    uploadSpy.mockRestore();
  });

  it('should leave 5 items in array after pushing 4005 items with batch size of 2000', async () => {
    const items = createItems(4005);
    await repo.push(items);

    expect(repo.getItems().length).toBe(5);
  });

  describe('should take batch size into account', () => {
    beforeEach(() => {
      repo = new Repo({
        event: createEvent({ eventType: EventType.ExtractionDataStart }),
        itemType: 'test_item_type',
        normalize,
        onUpload: jest.fn(),
        options: {
          batchSize: 50,
        },
      });
    });

    it('should empty the items array after pushing 50 items with batch size of 50', async () => {
      const items = createItems(50);
      await repo.push(items);
      expect(repo.getItems()).toEqual([]);
    });

    it('should leave 5 items in the items array after pushing 205 items with batch size of 50', async () => {
      const items = createItems(205);
      await repo.push(items);

      expect(repo.getItems().length).toBe(5);
    });

    it('should normalize all items when pushing 205 items with batch size of 50', async () => {
      const items = createItems(205);
      await repo.push(items);

      expect(normalize).toHaveBeenCalledTimes(205);
    });

    it('should upload 4 batches when pushing 205 items with batch size of 50', async () => {
      const uploadSpy = jest.spyOn(repo, 'upload');

      const items = createItems(205);
      await repo.push(items);

      expect(uploadSpy).toHaveBeenCalledTimes(4);
      uploadSpy.mockRestore();
    });

    it('should leave 5 items in array after pushing 205 items with batch size of 50', async () => {
      const items = createItems(205);
      await repo.push(items);

      expect(repo.getItems().length).toBe(5);
    });
  });
});
