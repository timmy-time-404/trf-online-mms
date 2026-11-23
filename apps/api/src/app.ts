import { Hono } from 'hono';

/**
 * Builds the HTTP application without starting a server, so tests can call it directly.
 * Feature modules register their routes here (src/modules/<domain>/routes.ts).
 */
export const createApp = () => {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));

  return app;
};
