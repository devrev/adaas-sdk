import { createEvent } from '../tests/test-helpers';
import { EventType } from '../types';
import { Uploader } from './uploader';

// mock uploader.upload method
jest.mock('./uploader', () => {
  return {
    Uploader: jest.fn().mockImplementation(() => {
      return {
        upload: jest.fn().mockResolvedValue({
          artifact: { key: 'value' },
          error: undefined,
        }),
      };
    }),
  };
});

describe('uploader.ts', () => {
  const mockEvent = createEvent({ eventType: EventType.ExtractionDataStart });

  const uploader = new Uploader({ event: mockEvent });

  it('should upload the file to the DevRev platform and return the artifact information', async () => {
    const entity = 'entity';
    const fetchedObjects = [{ key: 'value' }];

    const uploadResponse = await uploader.upload(entity, fetchedObjects);

    expect(uploadResponse).toEqual({
      artifact: { key: 'value' },
      error: undefined,
    });
  });
});
