import { axiosClient } from '../http/axios-client-internal';
import { createAxiosResponse } from '../tests/test-helpers';
import { createMockEvent } from './test-utils';
import { emit } from './control-protocol';
import { EventType, ExtractorEventType } from '../types/extraction';
import { LoaderEventType } from '../types/loading';

jest.mock('../http/axios-client-internal');

const mockedAxiosClient = jest.mocked(axiosClient);

describe('control-protocol.emit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedAxiosClient.post.mockResolvedValue(createAxiosResponse());
  });

  it.each([
    {
      title: 'extractor events',
      inputEventType: EventType.StartExtractingData,
      outputEventType: ExtractorEventType.DataExtractionProgress,
    },
    {
      title: 'loader events',
      inputEventType: EventType.StartLoadingData,
      outputEventType: LoaderEventType.DataLoadingProgress,
    },
    {
      title: 'unknown events',
      inputEventType: EventType.StartExtractingData,
      outputEventType: 'SOME_UNKNOWN_EVENT' as ExtractorEventType,
    },
  ])(
    'sets state dates from event context for $title',
    async ({ inputEventType, outputEventType }) => {
      const event = createMockEvent(undefined, {
        payload: {
          event_type: inputEventType,
          event_context: {
            extract_from: '2024-01-01T00:00:00.000Z',
            extract_to: '2024-06-01T00:00:00.000Z',
          },
        },
      });

      await emit({
        event,
        eventType: outputEventType,
      });

      expect(mockedAxiosClient.post).toHaveBeenCalledTimes(1);

      const [, body, config] = mockedAxiosClient.post.mock.calls[0] as [
        string,
        {
          event_type: string;
          event_context: {
            extract_from?: string;
            extract_to?: string;
          };
          worker_metadata: Record<string, unknown>;
        },
        { headers: Record<string, string> }
      ];

      expect(body).toMatchObject({
        event_type: outputEventType,
        event_context: expect.objectContaining({
          extract_from: '2024-01-01T00:00:00.000Z',
          extract_to: '2024-06-01T00:00:00.000Z',
        }),
        worker_metadata: expect.objectContaining({
          oldest_state_date: '2024-01-01T00:00:00.000Z',
          newest_state_date: '2024-06-01T00:00:00.000Z',
        }),
      });

      expect(config).toEqual(
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-DevRev-Client-Version': expect.any(String),
          }),
        })
      );
    }
  );

  it.each([
    {
      title: 'only extract_from is set',
      extractFrom: '2024-01-01T00:00:00.000Z',
      extractTo: undefined,
    },
    {
      title: 'only extract_to is set',
      extractFrom: undefined,
      extractTo: '2024-06-01T00:00:00.000Z',
    },
    {
      title: 'neither extract_from nor extract_to is set',
      extractFrom: undefined,
      extractTo: undefined,
    },
  ])(
    'handles state-date absence when $title',
    async ({ extractFrom, extractTo }) => {
      const event = createMockEvent(undefined, {
        payload: {
          event_type: EventType.StartExtractingData,
          event_context: {
            extract_from: extractFrom,
            extract_to: extractTo,
          },
        },
      });

      await emit({
        event,
        eventType: ExtractorEventType.DataExtractionProgress,
      });

      const [, body] = mockedAxiosClient.post.mock.calls[0] as [
        string,
        {
          worker_metadata: Record<string, unknown>;
        },
        unknown
      ];
      const workerMetadata = body.worker_metadata;

      expect(workerMetadata.oldest_state_date).toBe(extractFrom);
      expect(workerMetadata.newest_state_date).toBe(extractTo);
    }
  );

  it('overrides caller-provided worker_metadata state dates', async () => {
    const event = createMockEvent(undefined, {
      payload: {
        event_type: EventType.StartExtractingData,
        event_context: {
          extract_from: '2024-01-01T00:00:00.000Z',
          extract_to: '2024-06-01T00:00:00.000Z',
        },
      },
    });

    await emit({
      event,
      eventType: ExtractorEventType.DataExtractionProgress,
      worker_metadata: {
        item_type: 'tasks',
        oldest_state_date: 'should-be-overwritten',
        newest_state_date: 'should-be-overwritten',
      },
    });

    const [, body] = mockedAxiosClient.post.mock.calls[0] as [
      string,
      {
        worker_metadata: Record<string, unknown>;
      },
      unknown
    ];
    expect(body.worker_metadata).toEqual(
      expect.objectContaining({
        item_type: 'tasks',
        oldest_state_date: '2024-01-01T00:00:00.000Z',
        newest_state_date: '2024-06-01T00:00:00.000Z',
      })
    );
  });
});
