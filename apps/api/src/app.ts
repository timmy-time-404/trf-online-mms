import { Hono } from 'hono';
import { createAuthRoutes } from './auth.ts';
import type { openDatabase } from './db/connection.ts';
import { createTRFRoutes } from './modules/trf/routes.ts';

/**
 * Builds the HTTP application without starting a server, so tests can call it directly.
 * Feature modules register their routes here (src/modules/<domain>/routes.ts).
 */
export const createApp = (database?: ReturnType<typeof openDatabase>, origin?: string) => {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));
  if (database && origin) app.route('/auth', createAuthRoutes(database, origin));
  if (database && origin) app.route('/trfs', createTRFRoutes(database, origin));

  return app;
};
