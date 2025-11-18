import MockAdapter from 'axios-mock-adapter';

import { axiosClient } from '../../http/axios-client-internal';
import { run } from './extraction';
import { createEvent } from '../test-helpers';
import { EventType } from '../../types/extraction';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

describe('Worker OOM integration', () => {
  const axiosMock = new MockAdapter(axiosClient);
  const emittedEvents: unknown[] = [];
  const baseUrl = 'https://mock.devrev.test';

  afterEach(() => {
    axiosMock.reset();
    emittedEvents.length = 0;
  });

  beforeEach(() => {
    if (global.gc) {
      global.gc();
    }
  });

  it('emits a descriptive error when the worker crashes with an OOM-like error', async () => {
    const event = createEvent({
      eventType: EventType.ExtractionDataStart,
      eventContextOverrides: {
        callback_url: `${baseUrl}/internal/airdrop.external-extractor.message`,
        worker_data_url: `${baseUrl}/internal/airdrop.external-worker`,
      },
      executionMetadataOverrides: {
        devrev_endpoint: `${baseUrl}`,
      },
    });

    const callbackRegex = new RegExp(
      `${escapeRegex(baseUrl)}/internal/airdrop\\.external-extractor\\.message`
    );

    axiosMock.onPost(callbackRegex).reply((config) => {
      emittedEvents.push(JSON.parse(config.data));
      return [200, { success: true }];
    });

    await run(
      [event],
      __dirname + '/oom-simulated-crash',
      {
        workerHeapSizeMb: 96,
      }
    );

    expect(emittedEvents).toHaveLength(1);
    const payload = emittedEvents[0] as {
      event_type: string;
      event_data?: { error?: { message?: string } };
    };
    expect(payload.event_type).toBe('EXTRACTION_DATA_ERROR');
    expect(payload.event_data?.error?.message).toContain(
      'Worker exceeded memory limit'
    );

    const messageCall = axiosMock.history.post.find((req) =>
      req.url?.includes('airdrop.external-extractor.message')
    );

    expect(messageCall).toBeDefined();
  });
});

