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

    this.app.use(express.json());
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
      res.status(200).json({
        upload_url: `${this.baseUrl}/file-upload-url`,
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
    const { path, method, status, body, retry } = config;
    const key = this.getRouteKey(method, path);

    // Initialize request count for this route if retry is configured
    if (retry && !this.requestCounts.has(key)) {
      this.requestCounts.set(key, 0);
    }

    this.routeHandlers.set(key, (req: Request, res: Response) => {
      if (retry) {
        const currentCount = this.requestCounts.get(key) || 0;
        const failureCount = retry.failureCount ?? 4;
        const errorStatus = retry.errorStatus ?? 500;

        if (currentCount < failureCount) {
          this.requestCounts.set(key, currentCount + 1);
          if (retry.errorBody !== undefined) {
            res.status(errorStatus).json(retry.errorBody);
          } else {
            res.status(errorStatus).send();
          }
        } else {
          this.requestCounts.set(key, currentCount + 1);
          if (body !== undefined) {
            res.status(status).json(body);
          } else {
            this.defaultRouteHandler(req, res);
          }
        }
      } else {
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
   */
  public resetRoutes(): void {
    this.routeHandlers.clear();
    this.requestCounts.clear();
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
}
