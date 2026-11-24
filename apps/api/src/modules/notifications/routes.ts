import { protectedRoutes, found, uuid, type Database } from '../../http.ts';
import * as repo from './repository.ts';
export function createNotificationsRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.get('/', async (c) => c.json((await repo.list(db, c.get('actor').id)).map(repo.dto)));
  app.post('/read-all', async (c) => { await repo.markAllRead(db, c.get('actor').id); return c.json({ success: true }); });
  app.post('/:id/read', async (c) => c.json(repo.dto(found(await repo.markRead(db, c.get('actor').id, uuid(c.req.param('id')))))));
  return app;
}
