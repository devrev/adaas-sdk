import { MockServer } from '../mock-server/mock-server';
import { DEFAULT_PORT } from '../mock-server/mock-server.interfaces';

jest.setTimeout(15000); // 15 seconds

export const mockServer = new MockServer(DEFAULT_PORT);

beforeAll(async () => {
  await mockServer.start();
});

afterAll(async () => {
  await mockServer.stop();
});

beforeEach(() => {
  mockServer.resetRoutes();
});
