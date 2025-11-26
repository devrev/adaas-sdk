import { Request, Response } from 'express';

export const DEFAULT_PORT = 3001;

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
export type RouteHandler = (req: Request, res: Response) => unknown;
