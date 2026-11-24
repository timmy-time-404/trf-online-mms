import { businessDate, businessWeekStart } from '@trf/shared';
import { z } from 'zod';
import { protectedRoutes, parse, type Database } from '../../http.ts';
import { visibleRows } from './repository.ts';
import { dashboardStats, weeklyTravel } from './service.ts';
export function createDashboardRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.get('/stats', async (c) => c.json(dashboardStats(await visibleRows(db, c.get('actor')), businessDate())));
  app.get('/weekly', async (c) => {
    const weekStart = parse(z.iso.date(), c.req.query('weekStart') ?? businessWeekStart());
    return c.json(weeklyTravel(await visibleRows(db, c.get('actor')), weekStart));
  });
  return app;
}
