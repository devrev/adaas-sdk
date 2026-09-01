import { MockServer } from '../../mock-server/mock-server';

/**
 * Dedicated mock server for upload-failure tests so they do not share the global
 * jest.setup singleton with other suites running in parallel in the same worker.
 * Port 0 assigns a unique port per instance.
 */
export const mockServer = new MockServer(0);

beforeAll(async () => {
  await mockServer.start();
});

afterAll(async () => {
  await mockServer.stop();
});

beforeEach(() => {
  mockServer.resetRoutes();
});
