import { Hono } from 'hono';
import { createAuthRoutes } from './auth.ts';
import type { openDatabase } from './db/connection.ts';
import { createTRFRoutes } from './modules/trf/routes.ts';
import { createUsersRoutes } from './modules/users/routes.ts';
import { createEmployeesRoutes } from './modules/employees/routes.ts';
import { createHotelsRoutes } from './modules/hotels/routes.ts';
import { createReferenceRoutes } from './modules/reference/routes.ts';
import { createLocationsRoutes } from './modules/locations/routes.ts';
import { createNotificationsRoutes } from './modules/notifications/routes.ts';
import { createDashboardRoutes } from './modules/dashboard/routes.ts';

/**
 * Builds the HTTP application without starting a server, so tests can call it directly.
 * Feature modules register their routes here (src/modules/<domain>/routes.ts).
 */
export const createApp = (database?: ReturnType<typeof openDatabase>, origin?: string) => {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));
  if (database && origin) app.route('/auth', createAuthRoutes(database, origin));
  if (database && origin) app.route('/trfs', createTRFRoutes(database, origin));
  if (database && origin) {
    app.route('/users', createUsersRoutes(database, origin));
    app.route('/employees', createEmployeesRoutes(database, origin));
    app.route('/hotels', createHotelsRoutes(database, origin));
    app.route('/reference', createReferenceRoutes(database, origin));
    app.route('/locations', createLocationsRoutes(database, origin));
    app.route('/notifications', createNotificationsRoutes(database, origin));
    app.route('/dashboard', createDashboardRoutes(database, origin));
  }

  return app;
};
