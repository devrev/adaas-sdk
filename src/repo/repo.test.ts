import { AIRDROP_DEFAULT_ITEM_TYPES } from '../common/constants';
import { createEvent, createItems, normalizeItem } from '../tests/test-helpers';
import { EventType } from '../types';
import { Repo } from './repo';

jest.mock('../tests/test-helpers', () => ({
  ...jest.requireActual('../tests/test-helpers'),
  normalizeItem: jest.fn(),
}));

describe('Repo class push method', () => {
  let repo: Repo;
  let normalize: jest.Mock;

  beforeEach(() => {
    normalize = jest.fn();
    repo = new Repo({
      event: createEvent({ eventType: EventType.ExtractionDataStart }),
      itemType: 'test_item_type',
      normalize,
      onUpload: jest.fn(),
      options: {},
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should not push items if items array is empty', async () => {
    await repo.push([]);
    expect(repo.getItems()).toEqual([]);
  });

  it('should normalize and push 10 items if array is not empty', async () => {
    const items = createItems(10);
    await repo.push(items);
    expect(normalize).toHaveBeenCalledTimes(10);

    const normalizedItems = items.map((item) => normalizeItem(item));
    expect(repo.getItems()).toEqual(normalizedItems);
  });

  it('should not normalize items if normalize function is not provided', async () => {
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

  describe('should not normalize items if type is "external_domain_metadata" or "ssor_attachment"', () => {
    it('item type: external_domain_metadata', async () => {
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

    it('item type: ssor_attachment', async () => {
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
  });

  it('should leave 5 items in the items array after pushing 2005 items with batch size of 2000', async () => {
    const items = createItems(2005);
    await repo.push(items);

    expect(repo.getItems().length).toBe(5);
  });

  it('should upload 2 batches of 2000 and leave 5 items in the items array after pushing 4005 items with batch size of 2000', async () => {
    const uploadSpy = jest.spyOn(repo, 'upload');

    const items = createItems(4005);
    await repo.push(items);

    expect(normalize).toHaveBeenCalledTimes(4005);
    expect(repo.getItems().length).toBe(5);
    expect(uploadSpy).toHaveBeenCalledTimes(2); // Check that upload was called twice

    uploadSpy.mockRestore();
  });
});
