import { z } from 'zod';
import { protectedRoutes, jsonBody, found, uuid, type Database } from '../../http.ts';
import * as repo from './repository.ts';
const hotelInput = z.object({ name: z.string().trim().min(1).max(200), totalRooms: z.number().int().min(0).max(100000).nullable().optional() }).strict();
export function createHotelsRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin, ['GA', 'SUPER_ADMIN']);
  app.get('/', async (c) => c.json((await repo.list(db)).map(repo.dto)));
  app.post('/', async (c) => c.json(repo.dto(found(await repo.create(db, await jsonBody(hotelInput, c.req)))), 201));
  app.put('/:id', async (c) => c.json(repo.dto(found(await repo.update(db, uuid(c.req.param('id')), await jsonBody(hotelInput, c.req))))));
  app.delete('/:id', async (c) => c.json(found(await repo.remove(db, uuid(c.req.param('id'))))));
  return app;
}
