import {
  ActionType,
  ItemTypeToLoad,
  LoaderReport,
  StatsFileObject,
} from '../../types/loading';

import {
  addReportToLoaderReport,
  getFilesToLoad,
} from './worker-adapter.helpers';

describe(getFilesToLoad.name, () => {
  let statsFile: StatsFileObject[];

  beforeEach(() => {
    statsFile = [
      {
        id: 'test-artifact-1',
        file_name: 'test_file_1.json.gz',
        item_type: 'issues',
        count: '79',
      },
      {
        id: 'test-artifact-2',
        file_name: 'test_file_2.json.gz',
        item_type: 'comments',
        count: '1079',
      },
      {
        id: 'test-artifact-3',
        file_name: 'test_file_3.json.gz',
        item_type: 'issues',
        count: '1921',
      },
      {
        id: 'test-artifact-4',
        file_name: 'test_file_4.json.gz',
        item_type: 'comments',
        count: '921',
      },
      {
        id: 'test-artifact-5',
        file_name: 'test_file_5.json.gz',
        item_type: 'attachments',
        count: '50',
      },
      {
        id: 'test-artifact-6',
        file_name: 'test_file_6.json.gz',
        item_type: 'unknown',
        count: '50',
      },
      {
        id: 'test-artifact-7',
        file_name: 'test_file_7.json.gz',
        item_type: 'issues',
        count: '32',
      },
    ];
  });

  it('should filter files by supported item types and order them correctly', () => {
    // Arrange
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'attachments', create: jest.fn(), update: jest.fn() },
      { itemType: 'issues', create: jest.fn(), update: jest.fn() },
    ];
    const expectedResult = [
      {
        id: 'test-artifact-5',
        itemType: 'attachments',
        count: 50,
        file_name: 'test_file_5.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'test-artifact-1',
        itemType: 'issues',
        count: 79,
        file_name: 'test_file_1.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'test-artifact-3',
        itemType: 'issues',
        count: 1921,
        file_name: 'test_file_3.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'test-artifact-7',
        itemType: 'issues',
        count: 32,
        file_name: 'test_file_7.json.gz',
        completed: false,
        lineToProcess: 0,
      },
    ];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });

    // Assert
    expect(result).toEqual(expectedResult);
  });

  it('should ignore files with unrecognized item types in statsFile', () => {
    // Arrange
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'issues', create: jest.fn(), update: jest.fn() },
      { itemType: 'unrecognized', create: jest.fn(), update: jest.fn() },
    ];
    const expectedResult = [
      {
        id: 'test-artifact-1',
        itemType: 'issues',
        count: 79,
        file_name: 'test_file_1.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'test-artifact-3',
        itemType: 'issues',
        count: 1921,
        file_name: 'test_file_3.json.gz',
        completed: false,
        lineToProcess: 0,
      },
      {
        id: 'test-artifact-7',
        itemType: 'issues',
        count: 32,
        file_name: 'test_file_7.json.gz',
        completed: false,
        lineToProcess: 0,
      },
    ];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });

    // Assert
    expect(result).toEqual(expectedResult);
  });

  it('should parse count string to number', () => {
    // Arrange
    const singleItemStatsFile: StatsFileObject[] = [
      {
        id: 'test-artifact-single',
        file_name: 'test_file_single.json.gz',
        item_type: 'issues',
        count: '12345',
      },
    ];
    const supportedItemTypes = ['issues'];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes,
      statsFile: singleItemStatsFile,
    });

    // Assert
    expect(result[0].count).toBe(12345);
    expect(typeof result[0].count).toBe('number');
  });

  it('should initialize completed as false and lineToProcess as 0', () => {
    // Arrange
    const singleItemStatsFile: StatsFileObject[] = [
      {
        id: 'test-artifact-init',
        file_name: 'test_file_init.json.gz',
        item_type: 'issues',
        count: '100',
      },
    ];
    const supportedItemTypes = ['issues'];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes,
      statsFile: singleItemStatsFile,
    });

    // Assert
    expect(result[0].completed).toBe(false);
    expect(result[0].lineToProcess).toBe(0);
  });

  it('[edge] should return an empty array when statsFile is empty', () => {
    // Arrange
    const emptyStatsFile: StatsFileObject[] = [];
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'issues', create: jest.fn(), update: jest.fn() },
    ];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile: emptyStatsFile,
    });

    // Assert
    expect(result).toEqual([]);
  });

  it('[edge] should return an empty array when supportedItemTypes is empty', () => {
    // Arrange
    const supportedItemTypes: string[] = [];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes,
      statsFile,
    });

    // Assert
    expect(result).toEqual([]);
  });

  it('[edge] should return an empty array when statsFile has no matching items', () => {
    // Arrange
    const itemTypesToLoad: ItemTypeToLoad[] = [
      { itemType: 'users', create: jest.fn(), update: jest.fn() },
    ];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes: itemTypesToLoad.map((it) => it.itemType),
      statsFile,
    });

    // Assert
    expect(result).toEqual([]);
  });

  it('[edge] should return an empty array when both statsFile and supportedItemTypes are empty', () => {
    // Arrange
    const emptyStatsFile: StatsFileObject[] = [];
    const supportedItemTypes: string[] = [];

    // Act
    const result = getFilesToLoad({
      supportedItemTypes,
      statsFile: emptyStatsFile,
    });

    // Assert
    expect(result).toEqual([]);
  });
});

describe(addReportToLoaderReport.name, () => {
  it('should add a new report when no existing report for the item type', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 10,
      [ActionType.UPDATED]: 5,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      item_type: 'issues',
      [ActionType.CREATED]: 10,
      [ActionType.UPDATED]: 5,
    });
  });

  it('should merge created counts when report for item type already exists', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.CREATED]: 10,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 5,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.CREATED]).toBe(15);
  });

  it('should merge updated counts when report for item type already exists', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.UPDATED]: 20,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.UPDATED]: 8,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.UPDATED]).toBe(28);
  });

  it('should merge failed counts when report for item type already exists', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.FAILED]: 3,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.FAILED]: 2,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.FAILED]).toBe(5);
  });

  it('should merge all action types when report for item type already exists', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.CREATED]: 10,
        [ActionType.UPDATED]: 20,
        [ActionType.FAILED]: 3,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 5,
      [ActionType.UPDATED]: 8,
      [ActionType.FAILED]: 2,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      item_type: 'issues',
      [ActionType.CREATED]: 15,
      [ActionType.UPDATED]: 28,
      [ActionType.FAILED]: 5,
    });
  });

  it('should add reports for different item types separately', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.CREATED]: 10,
      },
    ];
    const report: LoaderReport = {
      item_type: 'comments',
      [ActionType.CREATED]: 50,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      item_type: 'issues',
      [ActionType.CREATED]: 10,
    });
    expect(result[1]).toEqual({
      item_type: 'comments',
      [ActionType.CREATED]: 50,
    });
  });

  it('should preserve existing count when new report has undefined for an action type', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.CREATED]: 10,
        [ActionType.UPDATED]: 5,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 3,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.CREATED]).toBe(13);
    expect(result[0][ActionType.UPDATED]).toBe(5);
  });

  it('should use new report count when existing report has undefined for an action type', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.CREATED]: 10,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 3,
      [ActionType.UPDATED]: 7,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.CREATED]).toBe(13);
    expect(result[0][ActionType.UPDATED]).toBe(7);
  });

  it('should mutate and return the same loaderReports array', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 10,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toBe(loaderReports);
  });

  it('[edge] should handle report with only item_type and no action counts', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [];
    const report: LoaderReport = {
      item_type: 'issues',
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ item_type: 'issues' });
  });

  it('[edge] should handle merging when both reports have zero counts', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.CREATED]: 0,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 0,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.CREATED]).toBe(0);
  });

  it('[edge] should handle empty loaderReports array', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [];
    const report: LoaderReport = {
      item_type: 'attachments',
      [ActionType.CREATED]: 25,
      [ActionType.FAILED]: 1,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      item_type: 'attachments',
      [ActionType.CREATED]: 25,
      [ActionType.FAILED]: 1,
    });
  });

  it('[edge] should preserve existing created count when new report has undefined created', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.CREATED]: 10,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.UPDATED]: 5,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.CREATED]).toBe(10);
    expect(result[0][ActionType.UPDATED]).toBe(5);
  });

  it('[edge] should preserve existing updated count when new report has undefined updated', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.UPDATED]: 15,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 3,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.UPDATED]).toBe(15);
    expect(result[0][ActionType.CREATED]).toBe(3);
  });

  it('[edge] should preserve existing failed count when new report has undefined failed', () => {
    // Arrange
    const loaderReports: LoaderReport[] = [
      {
        item_type: 'issues',
        [ActionType.FAILED]: 7,
      },
    ];
    const report: LoaderReport = {
      item_type: 'issues',
      [ActionType.CREATED]: 2,
    };

    // Act
    const result = addReportToLoaderReport({ loaderReports, report });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0][ActionType.FAILED]).toBe(7);
    expect(result[0][ActionType.CREATED]).toBe(2);
  });
});
