import axios from 'axios'; 
import { installInitialDomainMapping } from './install-initial-domain-mapping';
import { axiosClient } from '../http/axios-client';
import { serializeAxiosError } from '../logger/logger';
import { InitialDomainMapping } from '../types';
import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types/extraction';

// Mock dependencies
jest.mock('axios', () => ({
  ...jest.requireActual('axios'),
  isAxiosError: jest.fn(),
}));
jest.mock('../http/axios-client');
jest.mock('../logger/logger');

const mockAxiosClient = axiosClient as jest.Mocked<typeof axiosClient>;
const mockIsAxiosError = axios.isAxiosError as unknown as jest.Mock;
const mockSerializeAxiosError = serializeAxiosError as jest.Mock;

describe('installInitialDomainMapping', () => {
  // Create mock objects
  const mockEvent = createEvent({ eventType: EventType.ExtractionDataStart });

  const mockInitialDomainMapping: InitialDomainMapping = {
    starting_recipe_blueprint: {
      name: 'Test Recipe Blueprint',
      description: 'Test description',
    },
    additional_mappings: {
      custom_field: 'custom_value',
    },
  };

  const mockSnapInResponse = {
    data: {
      snap_in: {
        imports: [{ name: 'import-slug-123' }],
        snap_in_version: { slug: 'snap-in-slug-123' },
      },
    },
  };

  const mockEndpoint = 'test_devrev_endpoint';
  const mockToken = 'test_token';

  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleWarn: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  // Before each test, create a fresh spy.
  beforeEach(() => {
    // Re-initialize the spy and its mock implementation
    mockConsoleLog = jest.spyOn(console, 'log').mockImplementation(() => {});
    mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockConsoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // After each test, clear all mocks to prevent state from leaking.
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully install initial domain mapping with recipe blueprint', async () => {
    // Mock successful snap-in response
    mockAxiosClient.get.mockResolvedValueOnce(mockSnapInResponse);

    // Mock successful recipe blueprint creation
    const mockRecipeBlueprintResponse = {
      data: {
        recipe_blueprint: {
          id: 'recipe-blueprint-123',
        },
      },
    };
    mockAxiosClient.post.mockResolvedValueOnce(mockRecipeBlueprintResponse);

    // Mock successful domain mapping installation
    const mockDomainMappingResponse = {
      data: {
        success: true,
        mapping_id: 'mapping-123',
      },
    };
    mockAxiosClient.post.mockResolvedValueOnce(mockDomainMappingResponse);

    await installInitialDomainMapping(mockEvent, mockInitialDomainMapping);

    // Verify snap-in details request
    expect(mockAxiosClient.get).toHaveBeenCalledWith(
      `${mockEndpoint}/internal/snap-ins.get`,
      {
        headers: {
          Authorization: mockToken,
        },
        params: {
          id: 'test_snap_in_id',
        },
      }
    );

    // Verify recipe blueprint creation
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${mockEndpoint}/internal/airdrop.recipe.blueprints.create`,
      {
        name: 'Test Recipe Blueprint',
        description: 'Test description',
      },
      {
        headers: {
          Authorization: mockToken,
        },
      }
    );

    // Verify domain mapping installation
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${mockEndpoint}/internal/airdrop.recipe.initial-domain-mappings.install`,
      {
        external_system_type: 'ADaaS',
        import_slug: 'import-slug-123',
        snap_in_slug: 'snap-in-slug-123',
        starting_recipe_blueprint: 'recipe-blueprint-123',
        custom_field: 'custom_value',
      },
      {
        headers: {
          Authorization: mockToken,
        },
      }
    );

    expect(mockConsoleLog).toHaveBeenCalledWith(
      'Successfully created recipe blueprint with id: recipe-blueprint-123'
    );
    expect(mockConsoleLog).toHaveBeenCalledWith(
      'Successfully installed initial domain mapping: {"success":true,"mapping_id":"mapping-123"}'
    );
  });

  it('should successfully install without recipe blueprint when not provided', async () => {
    const mappingWithoutBlueprint: InitialDomainMapping = {
      additional_mappings: {
        custom_field: 'custom_value',
      },
    };

    mockAxiosClient.get.mockResolvedValueOnce(mockSnapInResponse);

    const mockDomainMappingResponse = {
      data: { success: true },
    };
    mockAxiosClient.post.mockResolvedValueOnce(mockDomainMappingResponse);

    await installInitialDomainMapping(mockEvent, mappingWithoutBlueprint);

    // Should only make one POST request (no recipe blueprint creation)
    expect(mockAxiosClient.post).toHaveBeenCalledTimes(1);
    expect(mockAxiosClient.post).toHaveBeenCalledWith(
      `${mockEndpoint}/internal/airdrop.recipe.initial-domain-mappings.install`,
      {
        external_system_type: 'ADaaS',
        import_slug: 'import-slug-123',
        snap_in_slug: 'snap-in-slug-123',
        custom_field: 'custom_value',
      },
      {
        headers: {
          Authorization: mockToken,
        },
      }
    );
  });

  it('should handle empty starting_recipe_blueprint object', async () => {
    const mappingWithEmptyBlueprint: InitialDomainMapping = {
      starting_recipe_blueprint: {},
      additional_mappings: {
        custom_field: 'custom_value',
      },
    };

    mockAxiosClient.get.mockResolvedValueOnce(mockSnapInResponse);

    const mockDomainMappingResponse = {
      data: { success: true },
    };
    mockAxiosClient.post.mockResolvedValueOnce(mockDomainMappingResponse);

    await installInitialDomainMapping(mockEvent, mappingWithEmptyBlueprint);

    // Should only make one POST request (no recipe blueprint creation for empty object)
    expect(mockAxiosClient.post).toHaveBeenCalledTimes(1);
  });

  it('should return early with warning when no initial domain mapping provided', async () => {
    await installInitialDomainMapping(mockEvent, null as any);

    expect(mockConsoleWarn).toHaveBeenCalledWith('No initial domain mapping found.');
    expect(mockAxiosClient.get).not.toHaveBeenCalled();
    expect(mockAxiosClient.post).not.toHaveBeenCalled();
  });

  it('should return early with warning when undefined initial domain mapping provided', async () => {
    await installInitialDomainMapping(mockEvent, undefined as any);

    expect(mockConsoleWarn).toHaveBeenCalledWith('No initial domain mapping found.');
    expect(mockAxiosClient.get).not.toHaveBeenCalled();
    expect(mockAxiosClient.post).not.toHaveBeenCalled();
  });

  it('should throw error when import slug is missing', async () => {
    const snapInResponseWithoutImport = {
      data: {
        snap_in: {
          imports: [],
          snap_in_version: { slug: 'snap-in-slug-123' },
        },
      },
    };

    mockAxiosClient.get.mockResolvedValueOnce(snapInResponseWithoutImport);

    await expect(
      installInitialDomainMapping(mockEvent, mockInitialDomainMapping)
    ).rejects.toThrow('No import slug or snap-in slug found');
  });

  it('should throw error when snap-in slug is missing', async () => {
    const snapInResponseWithoutSlug = {
      data: {
        snap_in: {
          imports: [{ name: 'import-slug-123' }],
          snap_in_version: {},
        },
      },
    };

    mockAxiosClient.get.mockResolvedValueOnce(snapInResponseWithoutSlug);

    await expect(
      installInitialDomainMapping(mockEvent, mockInitialDomainMapping)
    ).rejects.toThrow('No import slug or snap-in slug found');
  });

  it('should handle the error during recipe blueprint creation', async () => {
    mockAxiosClient.get.mockResolvedValueOnce(mockSnapInResponse);

    const genericError = new Error('Generic error during blueprint creation');

    // Mock axios.isAxiosError to return false
    mockIsAxiosError.mockReturnValue(false);

    mockAxiosClient.post.mockRejectedValueOnce(genericError);

    const mockDomainMappingResponse = {
      data: { success: true },
    };
    mockAxiosClient.post.mockResolvedValueOnce(mockDomainMappingResponse);

    await installInitialDomainMapping(mockEvent, mockInitialDomainMapping);

    // Should still proceed with domain mapping installation
    expect(mockAxiosClient.post).toHaveBeenCalledTimes(2);
  });

  it('should propagate error from domain mapping installation', async () => {
    mockAxiosClient.get.mockResolvedValueOnce(mockSnapInResponse);

      // Mock successful recipe blueprint creation
    const mockRecipeBlueprintResponse = {
      data: {
        recipe_blueprint: {
          id: 'recipe-blueprint-123',
        },
      },
    };
    mockAxiosClient.post.mockResolvedValueOnce(mockRecipeBlueprintResponse);

    const domainMappingError = new Error('Domain mapping installation failed');
    mockAxiosClient.post.mockRejectedValueOnce(domainMappingError);

    await expect(
      installInitialDomainMapping(mockEvent, mockInitialDomainMapping)
    ).rejects.toThrow('Domain mapping installation failed');
  });
});