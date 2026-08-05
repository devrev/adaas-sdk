import { createMockEvent, MOCK_SERVER_DEFAULT_URL } from '../common/test-utils';
import { axiosClient } from '../http/axios-client-internal';
import { EventType } from '../types/extraction';
import { RecordManager } from './record-manager';
import {
  RecordManagerDevRevLoaderSeenGetParams,
  RecordManagerDevRevLoaderSeenSetParams,
  RecordManagerExtractorRecordMergingSetParams,
  RecordManagerLoaderRecordMergingGetParams,
  RecordManagerLoaderRecordMergingSetParams,
} from './record-manager.interfaces';

// Mock the axios client
jest.mock('../http/axios-client-internal');
const mockAxiosClient = axiosClient as jest.Mocked<typeof axiosClient>;

describe(RecordManager.name, () => {
  const apiToken = 'test_service_token';
  const requestId = 'test_request_id';
  const devOrgId = 'test_dev_oid';
  const devrevObjectId = 'test_devrev_object_id';
  const baseParams = { request_id: requestId, dev_org_id: devOrgId };

  const mockEvent = createMockEvent(MOCK_SERVER_DEFAULT_URL, {
    context: {
      secrets: { service_account_token: apiToken },
    },
    payload: {
      event_type: EventType.StartExtractingData,
      event_context: { request_id: requestId, dev_oid: devOrgId },
    },
  });

  const recordManager = new RecordManager({ event: mockEvent });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should call ${recordManager.extractorRecordMergingSet.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: RecordManagerExtractorRecordMergingSetParams = {
      external_object_identifier: { external_record_id: 'ext-1' },
      external_object: { status: 'open', owner: 'bob' },
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await recordManager.extractorRecordMergingSet(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.extractor-record-merging.set`,
      { ...baseParams, ...params },
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });

  it(`should call ${recordManager.loaderRecordMergingSet.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: RecordManagerLoaderRecordMergingSetParams = {
      devrev_object_id: devrevObjectId,
      external_object: { status: 'closed' },
      devrev_changes: { status: 'closed' },
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await recordManager.loaderRecordMergingSet(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.loader-record-merging.set`,
      { ...baseParams, ...params },
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });

  it(`should call ${recordManager.loaderRecordMergingGet.name} with correct endpoint, headers and params`, async () => {
    // Arrange
    const params: RecordManagerLoaderRecordMergingGetParams = {
      devrev_object_id: devrevObjectId,
      external_object: { status: 'open' },
    };
    mockAxiosClient.get.mockResolvedValue({ data: {} });

    // Act
    await recordManager.loaderRecordMergingGet(params);

    // Assert
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.loader-record-merging.get`,
      {
        headers: {
          Authorization: apiToken,
        },
        params: { ...baseParams, ...params },
      }
    );
  });

  it(`should call ${recordManager.getDevRevLoaderSeen.name} with correct endpoint, headers and params`, async () => {
    // Arrange
    const params: RecordManagerDevRevLoaderSeenGetParams = {
      devrev_object_id: devrevObjectId,
      devrev_object: { status: 'open' },
    };
    mockAxiosClient.get.mockResolvedValue({ data: {} });

    // Act
    await recordManager.getDevRevLoaderSeen(params);

    // Assert
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.devrev-loader-record-merging.get`,
      {
        headers: {
          Authorization: apiToken,
        },
        params: { ...baseParams, ...params },
      }
    );
  });

  it(`should call ${recordManager.putDevRevLoaderSeen.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: RecordManagerDevRevLoaderSeenSetParams = {
      devrev_object_id: devrevObjectId,
      devrev_object: { status: 'closed' },
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await recordManager.putDevRevLoaderSeen(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.devrev-loader-record-merging.set`,
      { ...baseParams, ...params },
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });
});
