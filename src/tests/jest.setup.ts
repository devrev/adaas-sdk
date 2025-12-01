import { MockServer } from './mock-server/mock-server';

export const mockServer = new MockServer();

beforeAll(async () => {
  await mockServer.start();
});

afterAll(async () => {
  await mockServer.stop();
});

beforeEach(() => {
  mockServer.resetRoutes();
});
