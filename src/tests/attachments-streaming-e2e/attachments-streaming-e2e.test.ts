import { MockServer } from '../mock-server-2';
import { createEvent } from '../test-helpers';
import { AirdropEvent, EventType } from '../../types';
import run from './extraction';
import { extractionSdkState } from '../../state/state.interfaces';

jest.setTimeout(15000);

describe('Attachments streaming E2E', () => {
  let event: AirdropEvent;
  let mockServer: MockServer;

  afterEach(async () => {
    if (mockServer) {
      await mockServer.stop();
    }
  });

  it('should stream a single attachment with custom state', async () => {
    const testState = {
      ...extractionSdkState,
      toDevRev: {
        attachmentsMetadata: {
          artifactIds: [
            'test-artifact-id-1',
            'test-artifact-id-2',
            'test-artifact-id-3',
          ],
        },
      },
    };

    mockServer = new MockServer({
      overrides: [
        {
          path: '/worker_data_url.get',
          method: 'GET',
          response: {
            status: 200,
            body: {
              state: JSON.stringify(testState),
            },
          },
        },
      ],
    });
    await mockServer.start();

    event = createEvent({
      eventType: EventType.ExtractionAttachmentsStart,
      eventContextOverrides: {
        callback_url: `${mockServer.baseUrl}/callback_url`,
        worker_data_url: `${mockServer.baseUrl}/worker_data_url`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${mockServer.baseUrl}`,
      },
    });

    await run([event], __dirname + '/attachments-streaming-e2e');
  });
});
