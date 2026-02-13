import { MockServer } from './mock-server/mock-server';

// Use port 0 for dynamic port allocation, enabling parallel test execution
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
