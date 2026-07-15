import { createServer, IncomingMessage, Server, ServerResponse } from 'http';

import {
  DEFAULT_MOCK_SERVER_PORT,
  MockResponse,
  ParsedRequest,
  RequestCounts,
  RequestInfo,
  RouteConfig,
  RouteHandlers,
} from './mock-server.interfaces';

/**
 * Default base URL for the mock server. The port `0` lets the OS assign a free
 * port at listen time; tests read the resolved URL from `mockServer.baseUrl`.
 */
export const MOCK_SERVER_DEFAULT_URL = 'http://localhost:0';

const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10mb

/**
 * Parses the JSON body from an incoming request.
 */
async function parseJsonBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;

    req.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (chunks.length === 0) {
        resolve(undefined);
        return;
      }
      try {
        const raw = Buffer.concat(chunks).toString('utf-8');
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });

    req.on('error', reject);
  });
}

/**
 * Wraps a ServerResponse with helper methods (status, json, set, send).
 */
function wrapResponse(res: ServerResponse): MockResponse {
  const mock = res as MockResponse;
  let statusCode = 200;

  mock.set = (headers: Record<string, string>) => {
    for (const [key, value] of Object.entries(headers)) {
      res.setHeader(key, value);
    }
    return mock;
  };

  mock.status = (code: number) => {
    statusCode = code;
    return mock;
  };

  mock.json = (data: unknown) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
  };

  mock.buffer = (data: Buffer) => {
    res.writeHead(statusCode, { 'Content-Type': 'application/octet-stream' });
    res.end(data);
  };

  mock.send = () => {
    res.writeHead(statusCode);
    res.end();
  };

  return mock;
}

/**
 * MockServer used in tests to mock internal AirSync endpoints.
 * This is a simple mock server that listens on a port and responds to requests.
 * Supports per-test route configuration to simulate different response scenarios.
 */
export class MockServer {
  private server: Server | null = null;
  private internalPort: number;
  public port: number;
  public baseUrl: string;
  private routeHandlers: RouteHandlers = new Map();
  private requests: RequestInfo[] = [];
  private requestCounts: RequestCounts = new Map();

  constructor(port: number = DEFAULT_MOCK_SERVER_PORT) {
    this.internalPort = port;
    this.port = port;
    this.baseUrl = `http://localhost:${this.port}`;
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch(() => {
          res.writeHead(500);
          res.end();
        });
      });

      this.server.listen(this.internalPort, () => {
        const actualPort = (this.server?.address() as { port: number } | null)
          ?.port;
        if (actualPort) {
          this.port = actualPort;
          this.baseUrl = `http://localhost:${this.port}`;
        }
        console.log(`Mock server running on http://localhost:${this.port}.`);
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (!this.server) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Mock server stopped.');
          this.server = null;
          resolve();
        }
      });
    });
  }

  private async handleRequest(
    raw: IncomingMessage,
    rawRes: ServerResponse
  ): Promise<void> {
    const req = raw as ParsedRequest;
    const res = wrapResponse(rawRes);

    const urlPath = (req.url || '/').split('?')[0];
    req.path = urlPath;
    req.body = await parseJsonBody(req);

    const requestInfo: RequestInfo = {
      method: req.method || 'GET',
      url: req.url || urlPath,
      ...(req.body !== undefined && req.body !== null
        ? { body: req.body }
        : {}),
    };
    this.requests.push(requestInfo);

    const method = (req.method || 'GET').toUpperCase();
    const key = `${method}:${urlPath}`;
    const customHandler = this.routeHandlers.get(key);

    if (customHandler) {
      customHandler(req, res);
    } else {
      this.defaultRouteHandler(req, res);
    }
  }

  /**
   * Default route handler for the mock server. Returns { success: true } for
   * routes that are not explicitly set.
   */
  private defaultRouteHandler(req: ParsedRequest, res: MockResponse): void {
    if (req.method === 'GET' && req.path === '/worker_data_url.get') {
      res.status(200).json({
        state: JSON.stringify({}),
      });
    } else if (req.method === 'GET' && req.path === '/internal/snap-ins.get') {
      res.status(200).json({
        snap_in: {
          imports: [{ name: 'test_import_slug' }],
          snap_in_version: { slug: 'test_snap_in_slug' },
        },
      });
    } else if (
      req.method === 'GET' &&
      req.path === '/internal/airdrop.artifacts.upload-url'
    ) {
      const artifactId = `artifact-${Date.now()}-${Math.random()
        .toString(36)
        .substr(2, 9)}`;
      res.status(200).json({
        upload_url: `${this.baseUrl}/file-upload-url`,
        artifact_id: artifactId,
        form_data: [],
      });
    } else {
      res.status(200).json({ success: true });
    }
  }

  private getRouteKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * Configures a route to return a specific status code and optional response body.
   */
  public setRoute(config: RouteConfig): void {
    const { path, method, status, body, bodyBuffer, retry, headers, delay } =
      config;
    const key = this.getRouteKey(method, path);

    if (retry) {
      this.requestCounts.set(key, 0);
    }

    this.routeHandlers.set(key, (req: ParsedRequest, res: MockResponse) => {
      const sendResponse = (responseDelay?: number) => {
        const send = () => {
          if (retry) {
            const currentCount = this.requestCounts.get(key) || 0;
            const failureCount = retry.failureCount ?? 4;
            const errorStatus = retry.errorStatus ?? 500;

            if (currentCount < failureCount) {
              this.requestCounts.set(key, currentCount + 1);

              const sendFailure = () => {
                if (retry.headers) {
                  res.set(retry.headers);
                }

                if (retry.errorBody !== undefined) {
                  res.status(errorStatus).json(retry.errorBody);
                } else {
                  res.status(errorStatus).send();
                }
              };

              if (retry.delay) {
                setTimeout(sendFailure, retry.delay);
              } else {
                sendFailure();
              }
            } else {
              this.requestCounts.set(key, currentCount + 1);

              if (headers) {
                res.set(headers);
              }

              if (bodyBuffer !== undefined) {
                res.status(status).buffer(bodyBuffer);
              } else if (body !== undefined) {
                res.status(status).json(body);
              } else {
                this.defaultRouteHandler(req, res);
              }
            }
          } else {
            if (headers) {
              res.set(headers);
            }

            if (bodyBuffer !== undefined) {
              res.status(status).buffer(bodyBuffer);
            } else if (body !== undefined) {
              res.status(status).json(body);
            } else {
              res.status(status).send();
            }
          }
        };

        if (responseDelay) {
          setTimeout(send, responseDelay);
        } else {
          send();
        }
      };

      sendResponse(delay);
    });
  }

  /**
   * Resets all custom route handlers, restoring all default handlers.
   * Also clears request tracking data.
   */
  public resetRoutes(): void {
    this.routeHandlers.clear();
    this.requestCounts.clear();
    this.requests = [];
  }

  /**
   * Returns the most recent request or undefined if no requests exist.
   */
  public getLastRequest(): RequestInfo | undefined {
    if (this.requests.length === 0) {
      return undefined;
    }
    return this.requests[this.requests.length - 1];
  }

  /**
   * Gets the number of requests made to a specific endpoint.
   */
  public getRequestCount(method: string, path: string): number {
    return this.getRequests(method, path).length;
  }

  /**
   * Gets all requests made to a specific endpoint.
   */
  public getRequests(method: string, path: string): RequestInfo[] {
    const pathWithoutQuery = path.split('?')[0];
    return this.requests.filter(
      (req) =>
        req.method.toUpperCase() === method.toUpperCase() &&
        req.url.split('?')[0] === pathWithoutQuery
    );
  }
}
