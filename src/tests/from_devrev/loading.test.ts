import { getFilesToLoad } from '../../common/helpers';
import { ItemTypeToLoad, StatsFileObject } from '../../types/loading';

describe('getFilesToLoad', () => {
  let statsFile: StatsFileObject[];

  beforeEach(() => {
    statsFile = [
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/2',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'issues',
        count: '79',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/5',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'comments',
        count: '1079',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/9',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'issues',
        count: '1921',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/14',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'comments',
        count: '921',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'attachments',
        count: '50',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'unknown',
        count: '50',
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        file_name: 'transformer_issues_X.json.gz',
        item_type: 'issues',
        count: '32',
      },
    ];
  });

  it('should return an empty array if statsFile is empty', () => {
    statsFile = [];
    const itemTypesToLoad: ItemTypeToLoad[] = [];
    const result = getFilesToLoad({ itemTypesToLoad, statsFile });
    expect(result).toEqual([]);
  });

  it('should return an empty array if itemTypesToLoad is empty', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [];
    const result = getFilesToLoad({ itemTypesToLoad, statsFile });
    expect(result).toEqual([]);
  });

  it('should return an empty array if statsFile has no matching items', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'users', create: jest.fn(), update: jest.fn() },
    ];
    const result = getFilesToLoad({ itemTypesToLoad, statsFile });
    expect(result).toEqual([]);
  });

  it('should filter out files not in itemTypesToLoad and order them by itemTypesToLoad', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'attachments', create: jest.fn(), update: jest.fn() },
      { itemType: 'issues', create: jest.fn(), update: jest.fn() },
    ];
    const result = getFilesToLoad({ itemTypesToLoad, statsFile });
    expect(result).toEqual([
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        itemType: 'attachments',
        count: 50,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/2',
        itemType: 'issues',
        count: 79,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/9',
        itemType: 'issues',
        count: 1921,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        itemType: 'issues',
        count: 32,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
    ]);
  });

  it('should ignore files with unrecognized item types in statsFile', () => {
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'issues', create: jest.fn(), update: jest.fn() },
    ];
    const result = getFilesToLoad({
      itemTypesToLoad,
      statsFile,
    });

    expect(result).toEqual([
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/2',
        itemType: 'issues',
        count: 79,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/9',
        itemType: 'issues',
        count: 1921,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'don:core:dvrv-us-1:devo/1:artifact/99',
        itemType: 'issues',
        count: 32,
        file_name: 'transformer_issues_X.json.gz',
        completed: false,
        lineToProcess: 0,
      },
    ]);
  });
});
