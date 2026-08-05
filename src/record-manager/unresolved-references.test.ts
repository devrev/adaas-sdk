import { createMockEvent, MOCK_SERVER_DEFAULT_URL } from '../common/test-utils';
import { axiosClient } from '../http/axios-client-internal';
import { EventType } from '../types/extraction';
import { UnresolvedReferencesExternalSystemSpecifier } from './unresolved-references.interfaces';
import { UnresolvedReferences } from './unresolved-references';
import {
  UnresolvedReferenceDevRevType,
  UnresolvedReferencesListParams,
  UnresolvedReferencesResolveParams,
  UnresolvedReferencesSetParams,
} from './unresolved-references.interfaces';

// Mock the axios client
jest.mock('../http/axios-client-internal');
const mockAxiosClient = axiosClient as jest.Mocked<typeof axiosClient>;

describe(UnresolvedReferences.name, () => {
  const apiToken = 'test_service_token';

  const externalSystemSpecifier: UnresolvedReferencesExternalSystemSpecifier = {
    external_system_type: 'salesforce',
    external_system_name: 'salesforce',
    external_system_id: 'test_external_system_id',
  };

  const mockEvent = createMockEvent(MOCK_SERVER_DEFAULT_URL, {
    context: {
      secrets: { service_account_token: apiToken },
    },
    payload: { event_type: EventType.StartLoadingData },
  });

  const unresolvedReferences = new UnresolvedReferences({ event: mockEvent });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it(`should call ${unresolvedReferences.set.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: UnresolvedReferencesSetParams = {
      external_system_specifier: externalSystemSpecifier,
      object_external_id: 'task_1',
      object_devrev_type: UnresolvedReferenceDevRevType.WORK,
      sync_run_id: 'sync_run_1',
      sync_unit_id: 'sync_unit_1',
      unresolved_references: [
        {
          devrev_field_name: 'owner_id',
          referenced_external_id: 'user_42',
          referenced_devrev_type: UnresolvedReferenceDevRevType.USER,
        },
      ],
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await unresolvedReferences.set(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.unresolved-references.set`,
      params,
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });

  it(`should call ${unresolvedReferences.list.name} with correct endpoint, headers and params`, async () => {
    // Arrange
    const params: UnresolvedReferencesListParams = {
      external_system_specifier: externalSystemSpecifier,
      object_devrev_type: UnresolvedReferenceDevRevType.WORK,
      page: 1,
      limit: 50,
    };
    mockAxiosClient.get.mockResolvedValue({ data: {} });

    // Act
    await unresolvedReferences.list(params);

    // Assert
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.unresolved-references.list`,
      {
        headers: {
          Authorization: apiToken,
        },
        params,
      }
    );
  });

  it(`should call ${unresolvedReferences.resolve.name} with correct endpoint, headers and data`, async () => {
    // Arrange
    const params: UnresolvedReferencesResolveParams = {
      external_system_specifier: externalSystemSpecifier,
      object_external_id: 'task_1',
      object_devrev_type: UnresolvedReferenceDevRevType.WORK,
      resolved_references: [
        {
          devrev_field_name: 'owner_id',
          referenced_external_id: 'user_42',
          referenced_devrev_type: UnresolvedReferenceDevRevType.USER,
        },
      ],
    };
    mockAxiosClient.post.mockResolvedValue({ data: {} });

    // Act
    await unresolvedReferences.resolve(params);

    // Assert
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${MOCK_SERVER_DEFAULT_URL}/internal/airdrop.unresolved-references.resolve`,
      params,
      {
        headers: {
          Authorization: apiToken,
        },
      }
    );
  });
});
