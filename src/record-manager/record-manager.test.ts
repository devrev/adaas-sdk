import { createMockEvent, MOCK_SERVER_DEFAULT_URL } from '../common/test-utils';
import { axiosClient } from '../http/axios-client-internal';
import { EventType } from '../types/extraction';
import { RecordManager } from './record-manager';
import {
  RecordManagerDevRevLoaderSeenGetParams,
  RecordManagerDevRevLoaderSeenSetParams,
  RecordManagerExternalExtractorSeenSetParams,
  RecordManagerExternalLoaderSeenGetParams,
  RecordManagerExternalLoaderSeenSetParams,
  RecordManagerExternalSystemSpecifier,
} from './record-manager.interfaces';

// Mock the axios client
jest.mock('../http/axios-client-internal');
const mockAxiosClient = axiosClient as jest.Mocked<typeof axiosClient>;

describe(RecordManager.name, () => {
  const apiToken = 'test_service_token';
  const devrevId = 'test_devrev_id';

  const externalSystemSpecifier: RecordManagerExternalSystemSpecifier = {
    external_system_type: 'salesforce',
    external_system_name: 'salesforce',
    external_system_id: 'test_external_system_id',
  };

  const mockEvent = createMockEvent(MOCK_SERVER_DEFAULT_URL, {
    context: {
      secrets: { service_account_token: apiToken },
    },
    payload: { event_type: EventType.StartExtractingData },
  });

  const recordManager = new RecordManager({ event: mockEvent });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should call ${recordManager.getDevRevLoaderSeen.name} with correct endpoint, headers and params`, async () => {
    // Arrange
    const params: RecordManagerDevRevLoaderSeenGetParams = {
      devrev_id: devrevId,
      external_system_specifier: externalSystemSpecifier,
      devrev_object: { status: 'open' },
    };
    mockAxiosClient.get.mockResolvedValue({ data: {} });

    // Act
    await recordManager.getDevRevLoaderSeen(params);

    // Assert
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.record-devrev-loader-seen.get`,
      {
        headers: {
          Authorization: apiToken,
        },
        params,
      }
    );
  });

  it(`should call ${recordManager.putDevRevLoaderSeen.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: RecordManagerDevRevLoaderSeenSetParams = {
      devrev_id: devrevId,
      external_system_specifier: externalSystemSpecifier,
      devrev_object: { status: 'closed' },
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await recordManager.putDevRevLoaderSeen(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.record-devrev-loader-seen.set`,
      params,
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });

  it(`should call ${recordManager.getExternalLoaderSeen.name} with correct endpoint, headers and params`, async () => {
    // Arrange
    const params: RecordManagerExternalLoaderSeenGetParams = {
      devrev_id: devrevId,
      external_system_specifier: externalSystemSpecifier,
      external_object: { status: 'open' },
    };
    mockAxiosClient.get.mockResolvedValue({ data: {} });

    // Act
    await recordManager.getExternalLoaderSeen(params);

    // Assert
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.record-external-loader-seen.get`,
      {
        headers: {
          Authorization: apiToken,
        },
        params,
      }
    );
  });

  it(`should call ${recordManager.putExternalLoaderSeen.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: RecordManagerExternalLoaderSeenSetParams = {
      devrev_id: devrevId,
      external_system_specifier: externalSystemSpecifier,
      external_object: { status: 'closed' },
      devrev_changes: { status: 'closed' },
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await recordManager.putExternalLoaderSeen(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.record-external-loader-seen.set`,
      params,
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });

  it(`should call ${recordManager.putExternalExtractorSeen.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: RecordManagerExternalExtractorSeenSetParams = {
      devrev_id: devrevId,
      external_system_specifier: externalSystemSpecifier,
      external_object: { status: 'open', owner: 'bob' },
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await recordManager.putExternalExtractorSeen(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.record-external-extractor-seen.set`,
      params,
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });
});
