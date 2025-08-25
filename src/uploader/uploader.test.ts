import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types';
import { Uploader } from './uploader';
import { AxiosResponse } from 'axios';
import { axiosClient } from '../http/axios-client-internal';

jest.mock('../http/axios-client-internal', () => {
  const originalModule = jest.requireActual('../http/axios-client-internal');
  return {
    ...originalModule,
    axiosClient: {
      get: jest.fn(),
      post: jest.fn(),
    },
  };
});

const getSuccessResponse = (): AxiosResponse =>
  ({
    data: {
      message: 'Success',
    },
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }) as AxiosResponse;

const getArtifactUploadUrlMockResponse = {
  data: {
    artifact_id: 'mockArtifactId',
    upload_url: 'mockUploadUrl',
    form_data: [],
  },
};

describe(Uploader.name, () => {
  const mockEvent = createEvent({ eventType: EventType.ExtractionDataStart });

  let uploader: Uploader;

  beforeEach(() => {
    uploader = new Uploader({ event: mockEvent });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should upload the file to the DevRev platform and return the artifact information', async () => {
    // Mock successful response from getArtifactUploadUrl
    (axiosClient.get as jest.Mock).mockResolvedValueOnce(
      getArtifactUploadUrlMockResponse
    );
    // Mock successful response from confirmArtifactUpload and uploadArtifact
    (axiosClient.post as jest.Mock).mockResolvedValue(getSuccessResponse());

    const entity = 'entity';
    const fetchedObjects = [{ key: 'value' }];
    const uploadResponse = await uploader.upload(entity, fetchedObjects);

    expect(uploadResponse).toEqual({
      artifact: {
        id: 'mockArtifactId',
        item_type: entity,
        item_count: fetchedObjects.length,
      },
    });
  });

  it('[edge] should handle failure when getting artifact upload URL', async () => {
      // Mock unsuccessful response for getArtifactUploadUrl
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(undefined);

      const entity = 'entity';
      const fetchedObjects = [{ key: 'value' }];
      const uploadResponse = await uploader.upload(entity, fetchedObjects);

      expect(uploadResponse.error).toBeInstanceOf(Error);
      expect(uploadResponse.error?.message).toBeDefined();
    });

  it('[edge] should handle failure when uploading artifact', async () => {
      // Mock successful response for getArtifactUploadUrl
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        getArtifactUploadUrlMockResponse
      );
      // Mock unsuccessful response for uploadArtifact
      (axiosClient.post as jest.Mock).mockResolvedValueOnce(undefined);

      const entity = 'entity';
      const fetchedObjects = [{ key: 'value' }];
      const uploadResponse = await uploader.upload(entity, fetchedObjects);

      expect(uploadResponse.error).toBeInstanceOf(Error);
      expect(uploadResponse.error?.message).toBeDefined();
    });

  it('[edge] should handle failure when confirming artifact upload', async () => {
      // Mock successful response for getArtifactUploadUrl
      (axiosClient.get as jest.Mock).mockResolvedValueOnce(
        getArtifactUploadUrlMockResponse
      );
      // Mock successful response from uploadArtifact
      (axiosClient.post as jest.Mock).mockResolvedValueOnce(getSuccessResponse());
      // Mock unsuccessful response from confirmArtifactUpload
      (axiosClient.post as jest.Mock).mockResolvedValueOnce(undefined);

      const entity = 'entity';
      const fetchedObjects = [{ key: 'value' }];
      const uploadResponse = await uploader.upload(entity, fetchedObjects);

      expect(uploadResponse.error).toBeInstanceOf(Error);
      expect(uploadResponse.error?.message).toBeDefined();
    });
});
