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
import { createChangePasswordRoutes } from './modules/change-password/routes.ts';
import { createEmployeeManagementRoutes } from './modules/employee-management/routes.ts';
import { createRosterOperationsRoutes } from './modules/roster-operations/routes.ts';
import { createManpowerDashboardRoutes } from './modules/manpower-dashboard/routes.ts';
import { createEarlyRecallRoutes } from './modules/early-recall-workflow/routes.ts';
import { createDocumentRoutes, createPublicDocumentRoutes } from './modules/documents/routes.ts';
import type { FileStorage } from './modules/documents/storage.ts';

/** Optional services; document routes are mounted only when storage is configured. */
export interface AppServices { storage?: FileStorage; documentSigningKey?: string }

/**
 * Builds the HTTP application without starting a server, so tests can call it directly.
 * Feature modules register their routes here (src/modules/<domain>/routes.ts).
 */
export const createApp = (database?: ReturnType<typeof openDatabase>, origin?: string, services: AppServices = {}) => {
  const app = new Hono();

  app.get('/health', (c) => c.json({ status: 'ok' }));
  if (database && origin) app.route('/auth', createAuthRoutes(database, origin));
  if (database && origin) app.route('/trfs', createTRFRoutes(database, origin));
  if (database && origin) {
    app.route('/auth/change-password', createChangePasswordRoutes(database, origin));
    app.route('/employee-management', createEmployeeManagementRoutes(database, origin));
    app.route('/roster-operations', createRosterOperationsRoutes(database, origin));
    app.route('/manpower-dashboard', createManpowerDashboardRoutes(database, origin));
    app.route('/early-recall-workflow', createEarlyRecallRoutes(database, origin));
    app.route('/users', createUsersRoutes(database, origin));
    app.route('/employees', createEmployeesRoutes(database, origin));
    app.route('/hotels', createHotelsRoutes(database, origin));
    app.route('/reference', createReferenceRoutes(database, origin));
    app.route('/locations', createLocationsRoutes(database, origin));
    app.route('/notifications', createNotificationsRoutes(database, origin));
    app.route('/dashboard', createDashboardRoutes(database, origin));
    if (services.storage) app.route('/trf-documents', createDocumentRoutes(database, origin, services.storage));
    if (services.storage && services.documentSigningKey)
      app.route('/public/documents', createPublicDocumentRoutes(database, services.storage, services.documentSigningKey));
  }

  return app;
};
