import express, { Express, Request, Response } from 'express';
import { Server } from 'http';

import {
  DEFAULT_MOCK_SERVER_PORT,
  RequestCounts,
  RequestInfo,
  RouteConfig,
  RouteHandler,
  RouteHandlers,
} from './mock-server.interfaces';

/**
 * MockServer used in tests to mock internal AirSync endpoints.
 * This is a simple mock server that listens on a port and responds to requests.
 * Supports per-test route configuration to simulate different response scenarios.
 */
export class MockServer {
  private app: Express;
  private server: Server | null = null;
  public readonly port: number;
  public readonly baseUrl: string;
  private routeHandlers: RouteHandlers = new Map();
  private requests: RequestInfo[] = [];
  private requestCounts: RequestCounts = new Map();

  constructor(port: number = DEFAULT_MOCK_SERVER_PORT) {
    this.port = port;
    this.baseUrl = `http://localhost:${this.port}`;
    this.app = express();

    // Increase limit to handle size limit tests that send large artifact arrays
    this.app.use(express.json({ limit: '10mb' }));
    this.setupRoutes();
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
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

  /**
   * Sets up routes for the mock server.
   */
  private setupRoutes(): void {
    // TEST ENDPOINT
    this.app.get('/test-endpoint', this.routeHandler('GET', '/test-endpoint'));

    // CALLBACK URL
    this.app.post('/callback_url', this.routeHandler('POST', '/callback_url'));

    // WORKER DATA URL
    this.app.post(
      '/worker_data_url',
      this.routeHandler('POST', '/worker_data_url')
    );
    this.app.get(
      '/worker_data_url.get',
      this.routeHandler('GET', '/worker_data_url.get')
    );
    this.app.post(
      '/worker_data_url.update',
      this.routeHandler('POST', '/worker_data_url.update')
    );

    // SNAP-INS URL
    this.app.get(
      '/internal/snap-ins.get',
      this.routeHandler('GET', '/internal/snap-ins.get')
    );

    // AIRDROP RECIPE INITIAL DOMAIN MAPPINGS INSTALL URL
    this.app.post(
      '/internal/airdrop.recipe.initial-domain-mappings.install',
      this.routeHandler(
        'POST',
        '/internal/airdrop.recipe.initial-domain-mappings.install'
      )
    );

    // ARTIFACTS URL
    this.app.get(
      '/internal/airdrop.artifacts.upload-url',
      this.routeHandler('GET', '/internal/airdrop.artifacts.upload-url')
    );

    this.app.post(
      '/internal/airdrop.artifacts.confirm-upload',
      this.routeHandler('POST', '/internal/airdrop.artifacts.confirm-upload')
    );

    // FILE UPLOAD URL
    this.app.post(
      '/file-upload-url',
      this.routeHandler('POST', '/file-upload-url')
    );
  }

  /**
   * Creates a route handler that checks for custom handlers before using the default.
   * @param method - The HTTP method
   * @param path - The route path
   * @returns A route handler function
   */
  private routeHandler(method: string, path: string): RouteHandler {
    return (req: Request, res: Response) => {
      const requestInfo: RequestInfo = {
        method: req.method,
        url: req.url || req.path,
        ...(req.body !== undefined && req.body !== null
          ? { body: req.body }
          : {}),
      };

      this.requests.push(requestInfo);

      const key = `${method}:${path}`;
      const customHandler = this.routeHandlers.get(key);
      if (customHandler) {
        customHandler(req, res);
      } else {
        this.defaultRouteHandler(req, res);
      }
    };
  }

  /**
   * Default route handler for the mock server. Returns { success: true } for
   * routes that are not explicitly set.
   * @param req - The request object
   * @param res - The response object
   * @returns void
   */
  private defaultRouteHandler(req: Request, res: Response): void {
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
      // Generate a unique artifact ID for each request
      const artifactId = `artifact-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      res.status(200).json({
        upload_url: `${this.baseUrl}/file-upload-url`,
        artifact_id: artifactId,
        form_data: [], // Empty form_data for local development
      });
    } else {
      res.status(200).json({ success: true });
    }
  }

  /**
   * Gets the route key for a given method and path.
   * @param method - The HTTP method
   * @param path - The route path
   * @returns The route key in the format 'METHOD:path'
   */
  private getRouteKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * Configures a route to return a specific status code and optional response body.
   * @param config - The route configuration object
   * @param config.path - The path of the route (e.g., '/callback_url')
   * @param config.method - The HTTP method (e.g., 'GET', 'POST')
   * @param config.status - The HTTP status code to return (e.g., 200, 401, 500)
   * @param config.body - Optional response body to send as JSON
   * @param config.retry - Optional retry configuration for simulating failures before success
   */
  public setRoute(config: RouteConfig): void {
    const { path, method, status, body, retry, headers } = config;
    const key = this.getRouteKey(method, path);

    // Reset request count for this route if retry is configured
    // This ensures a clean state each time setRoute is called
    if (retry) {
      this.requestCounts.set(key, 0);
    }

    this.routeHandlers.set(key, (req: Request, res: Response) => {
      if (retry) {
        const currentCount = this.requestCounts.get(key) || 0;
        const failureCount = retry.failureCount ?? 4;
        const errorStatus = retry.errorStatus ?? 500;

        if (currentCount < failureCount) {
          this.requestCounts.set(key, currentCount + 1);

          if (retry.headers) {
            res.set(retry.headers);
          }

          if (retry.errorBody !== undefined) {
            res.status(errorStatus).json(retry.errorBody);
          } else {
            res.status(errorStatus).send();
          }
        } else {
          this.requestCounts.set(key, currentCount + 1);

          if (headers) {
            res.set(headers);
          }

          if (body !== undefined) {
            res.status(status).json(body);
          } else {
            this.defaultRouteHandler(req, res);
          }
        }
      } else {
        if (headers) {
          res.set(headers);
        }

        if (body !== undefined) {
          res.status(status).json(body);
        } else {
          res.status(status).send();
        }
      }
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
   * @returns The last RequestInfo object or undefined
   */
  public getLastRequest(): RequestInfo | undefined {
    if (this.requests.length === 0) {
      return undefined;
    }
    return this.requests[this.requests.length - 1];
  }

  /**
   * Gets the number of requests made to a specific endpoint.
   * @param method - The HTTP method (e.g., 'GET', 'POST')
   * @param path - The route path (e.g., '/test-endpoint', '/callback_url')
   * @returns The number of requests made to the endpoint
   */
  public getRequestCount(method: string, path: string): number {
    return this.getRequests(method, path).length;
  }

  /**
   * Gets all requests made to a specific endpoint.
   * @param method - The HTTP method (e.g., 'GET', 'POST')
   * @param path - The route path (e.g., '/test-endpoint', '/callback_url')
   * @returns An array of RequestInfo objects for the endpoint
   */
  public getRequests(method: string, path: string): RequestInfo[] {
    // Remove query parameters for comparison
    const pathWithoutQuery = path.split('?')[0];
    return this.requests.filter(
      (req) =>
        req.method.toUpperCase() === method.toUpperCase() &&
        req.url.split('?')[0] === pathWithoutQuery
    );
  }

  /**
   * Gets all requests made to the server across all endpoints.
   * @returns An array of all RequestInfo objects
   */
  public getAllRequests(): RequestInfo[] {
    return [...this.requests];
  }
}
