# Mock server

This folder contains a small HTTP mock server used by end-to-end style tests for code that runs in Node.js `worker_threads`. Since workers run in separate threads, Jest mocks don’t carry over, so we mock the backend with real HTTP endpoints (no need to deploy/run a snap-in).

It simulates internal backend routes workers call (state, callbacks, artifacts, etc.):

- **Defaults**: all registered routes return **200**; most return `{ success: true }` (some have endpoint-specific JSON defaults).
- **Overrides**: per-test, use `mockServer.setRoute({ path, method, status, body, headers, retry })` to return 4xx/5xx, custom bodies, or “fail N times then succeed”.
- **Assertions**: use `mockServer.getLastRequest()`, `mockServer.getRequests(method, path)`, and `mockServer.getRequestCount(method, path)`.
- **Lifecycle**: started/stopped once and reset per test in [`src/tests/jest.setup.ts`](../jest.setup.ts).

## Example

```ts
import { EventType, ExtractorEventType } from '../../types/extraction';
import { mockServer } from '../jest.setup';
import { createEvent } from '../test-helpers';

import run from './extraction';

it('retries state init (500 twice) then succeeds and emits done', async () => {
  // Simulate: GET /worker_data_url.get fails twice with 500, then returns 200.
  mockServer.setRoute({
    path: '/worker_data_url.get',
    method: 'GET',
    status: 200,
    retry: {
      failureCount: 2,
      errorStatus: 500,
      errorBody: { error: 'Internal Server Error' },
    },
  });

  const event = createEvent({ eventType: EventType.StartExtractingMetadata });
  await run([event], __dirname + '/metadata-extraction');

  // Assert retries happened (failures + final success).
  expect(mockServer.getRequestCount('GET', '/worker_data_url.get')).toBe(3);

  // Assert the worker reported completion via callback.
  const lastRequest = mockServer.getLastRequest();
  expect(lastRequest?.url).toContain('/callback_url');
  expect(lastRequest?.method).toBe('POST');
  expect((lastRequest?.body as { event_type: string }).event_type).toBe(
    ExtractorEventType.MetadataExtractionDone
  );
});
```

## See also

- Mock server implementation: [`src/tests/mock-server/mock-server.ts`](./mock-server.ts)
- Retry + error examples: [`src/tests/dummy-connector/metadata-extraction.test.ts`](../dummy-connector/metadata-extraction.test.ts)
- Worker timeout scenarios: [`src/tests/timeout-handling/`](../timeout-handling/)
