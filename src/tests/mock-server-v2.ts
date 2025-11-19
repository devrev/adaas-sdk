import express, { Express, Request, Response } from 'express';
import { Server } from 'http';

const DEFAULT_PORT = 3001;

/**
 * Configuration object for setting up a route response.
 */
export interface RouteConfig {
  /** The path of the route (e.g., '/callback_url', '/worker_data_url.get') */
  path: string;
  /** The HTTP method (e.g., 'GET', 'POST', 'PUT', 'DELETE') */
  method: string;
  /** The HTTP status code to return (e.g., 200, 401, 500) */
  status: number;
  /** Optional response body to send as JSON */
  body?: unknown;
}

/**
 * Type for custom route handler functions.
 */
type RouteHandler = (req: Request, res: Response) => void;

/**
 * Default response handler that returns { success: true }.
 */
const defaultHandler: RouteHandler = (_req: Request, res: Response) => {
  res.status(200).json({ success: true });
};

/**
 * MockServer used in tests to mock internal AirSync endpoints.
 * This is a simple mock server that listens on a port and responds to requests.
 * Supports per-test route configuration to simulate different response scenarios.
 */
export class MockServer {
  private app: Express;
  private server: Server | null = null;
  /** The port number the server is listening on */
  public readonly port: number;
  /** The base URL of the mock server (e.g., 'http://localhost:3001') */
  public readonly baseUrl: string;
  /** Registry of custom route handlers keyed by 'method:path' */
  private routeHandlers: Map<string, RouteHandler> = new Map();

  /**
   * Creates a new MockServer instance.
   * @param port - The port to listen on. Defaults to 3001.
   */
  constructor(port: number = DEFAULT_PORT) {
    this.port = port;
    this.baseUrl = `http://localhost:${this.port}`;
    this.app = express();

    this.setupMiddleware();
    this.setupRoutes();
  }

  /**
   * Sets up Express middleware for JSON parsing.
   * @private
   */
  private setupMiddleware(): void {
    this.app.use(express.json());
  }

  /**
   * Sets up default routes for the mock server.
   * All routes return { success: true } by default unless overridden.
   * @private
   */
  private setupRoutes(): void {
    // CALLBACK URL
    this.app.post(
      '/callback_url',
      this.createRouteHandler('POST', '/callback_url')
    );

    // WORKER DATA URL
    this.app.post(
      '/worker_data_url',
      this.createRouteHandler('POST', '/worker_data_url')
    );
    this.app.get(
      '/worker_data_url.get',
      this.createRouteHandler('GET', '/worker_data_url.get')
    );
    this.app.post(
      '/worker_data_url.update',
      this.createRouteHandler('POST', '/worker_data_url.update')
    );

    // SNAP-INS URL
    this.app.get(
      '/internal/snap-ins.get',
      this.createRouteHandler('GET', '/internal/snap-ins.get')
    );
  }

  /**
   * Creates a route handler that checks for custom handlers before using the default.
   * @param method - The HTTP method
   * @param path - The route path
   * @returns A route handler function
   * @private
   */
  private createRouteHandler(method: string, path: string): RouteHandler {
    return (req: Request, res: Response) => {
      const key = `${method}:${path}`;
      const customHandler = this.routeHandlers.get(key);
      if (customHandler) {
        customHandler(req, res);
      } else {
        defaultHandler(req, res);
      }
    };
  }

  /**
   * Gets the route key for a given method and path.
   * @param method - The HTTP method
   * @param path - The route path
   * @returns The route key in the format 'METHOD:path'
   * @private
   */
  private getRouteKey(method: string, path: string): string {
    return `${method.toUpperCase()}:${path}`;
  }

  /**
   * Registers a route handler for a specific method and path.
   * This handler will override the default handler for the route.
   * @param path - The path of the route (e.g., '/callback_url')
   * @param method - The HTTP method (e.g., 'GET', 'POST')
   * @param handler - The handler function that receives Express Request and Response objects
   */
  public mockRoute(path: string, method: string, handler: RouteHandler): void {
    const key = this.getRouteKey(method, path);
    this.routeHandlers.set(key, handler);
  }

  /**
   * Configures a route to return a specific status code and optional response body.
   * This is a convenience method for simple status/body responses.
   * @param config - The route configuration object
   * @param config.path - The path of the route (e.g., '/callback_url')
   * @param config.method - The HTTP method (e.g., 'GET', 'POST')
   * @param config.status - The HTTP status code to return (e.g., 200, 401, 500)
   * @param config.body - Optional response body to send as JSON
   */
  public setRoute(config: RouteConfig): void {
    const { path, method, status, body } = config;
    this.mockRoute(path, method, (req: Request, res: Response) => {
      if (body !== undefined) {
        res.status(status).json(body);
      } else {
        res.status(status).send();
      }
    });
  }

  /**
   * Clears a specific route handler, restoring the default handler.
   * @param path - The path of the route to clear
   * @param method - The HTTP method of the route to clear
   */
  public clearRoute(path: string, method: string): void {
    const key = this.getRouteKey(method, path);
    this.routeHandlers.delete(key);
  }

  /**
   * Resets all custom route handlers, restoring all default handlers.
   * This should be called in beforeEach hooks to ensure test isolation.
   */
  public resetRoutes(): void {
    this.routeHandlers.clear();
  }

  /**
   * Starts the mock server and begins listening on the configured port.
   * @returns A Promise that resolves when the server has started
   */
  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = this.app.listen(this.port, () => {
        console.log(
          `✅ Mock server running on http://localhost:${this.port}\n`
        );
        resolve();
      });
    });
  }

  /**
   * Stops the mock server and closes the connection.
   * @returns A Promise that resolves when the server has stopped, or rejects if an error occurs
   */
  public async stop(): Promise<void> {
    if (!this.server) {
      return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
      this.server!.close((err) => {
        if (err) {
          reject(err);
        } else {
          console.log('🛑 Mock server stopped\n');
          this.server = null;
          resolve();
        }
      });
    });
  }
}
