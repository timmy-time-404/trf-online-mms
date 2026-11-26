import { z } from 'zod';
import { protectedRoutes, jsonBody, found, uuid, type Database } from '../../http.ts';
import { writeAdminAudit } from '../../audit.ts';
import * as repo from './repository.ts';
const hotelInput = z.object({ name: z.string().trim().min(1).max(200), totalRooms: z.number().int().min(0).max(100000).nullable().optional() }).strict();
export function createHotelsRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin, ['GA', 'SUPER_ADMIN']);
  app.get('/', async (c) => c.json((await repo.list(db)).map(repo.dto)));
  app.post('/', async (c) => {
    const input = await jsonBody(hotelInput, c.req);
    return c.json(repo.dto(await db.begin(async (tx) => {
      const row = found(await repo.create(tx, input));
      await writeAdminAudit(tx, c.get('actor'), 'HOTEL', String(row.id), 'CREATE', null, row);
      return row;
    })), 201);
  });
  app.put('/:id', async (c) => {
    const id = uuid(c.req.param('id'));
    const input = await jsonBody(hotelInput, c.req);
    return c.json(repo.dto(await db.begin(async (tx) => {
      const before = found(await repo.find(tx, id));
      const row = found(await repo.update(tx, id, input));
      await writeAdminAudit(tx, c.get('actor'), 'HOTEL', id, 'UPDATE', before, row);
      return row;
    })));
  });
  app.delete('/:id', async (c) => {
    const id = uuid(c.req.param('id'));
    return c.json(await db.begin(async (tx) => {
      const before = found(await repo.find(tx, id));
      const row = found(await repo.remove(tx, id));
      await writeAdminAudit(tx, c.get('actor'), 'HOTEL', id, 'DELETE', before, null);
      return row;
    }));
  });
  return app;
}
