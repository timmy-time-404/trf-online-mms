import { z } from 'zod';
import { jsonBody, protectedRoutes, type Database } from '../../http.ts';
import { date, requireChangedPassword, rpc } from '../operations.ts';

export function createManpowerDashboardRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin, ['HOD', 'HR', 'PM', 'SUPER_ADMIN']);
  app.post('/', async (c) => {
    const actor = c.get('actor');
    await requireChangedPassword(db, actor);
    const body = await jsonBody(z.object({ action: z.literal('snapshot'), asOfDate: date }), c.req);
    const snapshot = await db.begin((tx) => rpc(tx, 'get_manpower_dashboard_snapshot', { p_actor_user_id: actor.id, p_as_of_date: body.asOfDate }));
    return c.json({ success: true, action: body.action, requestId: crypto.randomUUID(), snapshot });
  });
  return app;
}
