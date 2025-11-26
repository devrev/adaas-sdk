import { MockServer } from '../mock-server-v2/mock-server-v2';
import { DEFAULT_PORT } from '../mock-server-v2/mock-server-v2.interfaces';

jest.setTimeout(15000);

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
