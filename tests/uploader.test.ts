import { Uploader } from '../src/uploader';

// mock uploader.upload method
jest.mock('../src/uploader', () => {
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
  const uploader = new Uploader('https://example.com', 'test-token', false);

  it('should upload the file to the DevRev platform and return the artifact information', async () => {
    const filename = 'filename';
    const entity = 'entity';
    const fetchedObjects = [{ key: 'value' }];

    const uploadResponse = await uploader.upload(
      filename,
      entity,
      fetchedObjects
    );

    expect(uploadResponse).toEqual({
      artifact: { key: 'value' },
      error: undefined,
    });
  });
});
