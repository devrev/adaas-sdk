import { MockServer } from './mock-server/mock-server';
import { DEFAULT_MOCK_SERVER_PORT } from './mock-server/mock-server.interfaces';

export const mockServer = new MockServer(DEFAULT_MOCK_SERVER_PORT);

beforeAll(async () => {
  await mockServer.start();
});

afterAll(async () => {
  await mockServer.stop();
});

beforeEach(() => {
  mockServer.resetRoutes();
});
