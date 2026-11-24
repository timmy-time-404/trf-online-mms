import { z } from 'zod';
import { protectedRoutes, parse, type Database } from '../../http.ts';
import { visibleRows } from './repository.ts';
import { dashboardStats, weeklyTravel } from './service.ts';
export function createDashboardRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.get('/stats', async (c) => c.json(dashboardStats(await visibleRows(db, c.get('actor')), new Date().toISOString().slice(0, 10))));
  app.get('/weekly', async (c) => {
    const now = new Date(); const day = now.getUTCDay(); now.setUTCDate(now.getUTCDate() + (day === 0 ? -6 : 1 - day));
    const weekStart = parse(z.iso.date(), c.req.query('weekStart') ?? now.toISOString().slice(0, 10));
    return c.json(weeklyTravel(await visibleRows(db, c.get('actor')), weekStart));
  });
  // No source of occupancy data or approved calculation exists in the legacy application.
  app.get('/rooms', (c) => c.json([]));
  return app;
}
