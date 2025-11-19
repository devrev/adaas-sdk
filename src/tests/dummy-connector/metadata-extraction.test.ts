import * as controlProtocol from '../../common/control-protocol';
import {
  AirdropEvent,
  EventType,
  ExtractorEventType,
} from '../../types/extraction';
import { MockServer } from '../mock-server-v2';
import { createEvent } from '../test-helpers';
import run from './extraction';

jest.setTimeout(15000);

describe('Dummy Connector - Metadata Extraction', () => {
  let mockServer: MockServer;
  let event: AirdropEvent;
  let emitSpy: jest.SpyInstance;

  beforeAll(async () => {
    mockServer = new MockServer(3001);
    await mockServer.start();
  });

  afterAll(async () => {
    await mockServer.stop();
  });

  beforeEach(() => {
    mockServer.resetRoutes();
    emitSpy = jest.spyOn(controlProtocol, 'emit');
    event = createEvent({
      eventType: EventType.ExtractionMetadataStart,
      eventContextOverrides: {
        callback_url: `${mockServer.baseUrl}/callback_url`,
        worker_data_url: `${mockServer.baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: mockServer.baseUrl,
      },
    });
  });

  it('should emit metadata done event', async () => {
    mockServer.setRoute({
      path: '/worker_data_url.get',
      method: 'GET',
      status: 200,
      body: {
        state: JSON.stringify({
          state_key: 'state_value',
        }),
      },
    });

    mockServer.setRoute({
      path: '/internal/snap-ins.get',
      method: 'GET',
      status: 200,
      body: {
        snap_in: {
          imports: [{ name: 'test_import_slug' }],
        },
      },
    });

    await run([event], __dirname + '/workers/metadata-extraction');
    expect(emitSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: ExtractorEventType.ExtractionMetadataDone,
      })
    );
  });

  // it('should stop the extraction if it fails to get the state with 401 status code', async () => {
  //   mockServer.setRoute({
  //     path: '/worker_data_url.get',
  //     method: 'GET',
  //     status: 401,
  //     body: {
  //       error: 'Unauthorized',
  //       code: 'UNAUTHORIZED',
  //     },
  //   });
  //   });

  //   await run([event], __dirname + '/workers/metadata-extraction');
  //   expect(emitSpy).toHaveBeenCalledWith(
  //     expect.objectContaining({
  //       eventType: ExtractorEventType.ExtractionMetadataError,
  //     })
  //   );

  //   emitSpy.mockRestore();
  // });

  // it('should handle 500 server error on worker data endpoint', async () => {
  //   mockServer.setRoute({
  //     path: '/worker_data_url',
  //     method: 'POST',
  //     status: 500,
  //     body: {
  //       error: 'Internal Server Error',
  //       message: 'Something went wrong on the server',
  //     },
  //   });

  //   const event = createEvent({
  //     eventType: EventType.ExtractionMetadataStart,
  //     eventContextOverrides: {
  //       callback_url: `${mockServer.baseUrl}/callback_url`,
  //       worker_data_url: `${mockServer.baseUrl}/worker_data_url`,
  //     },
  //     executionMetadataOverrides: {
  //       devrev_endpoint: mockServer.baseUrl,
  //     },
  //   });

  //   await run([event], __dirname + '/workers/metadata-extraction');
  //   // Add your assertions here based on how your code handles 500 errors
  //   expect(true).toBe(true);
  // });
});
