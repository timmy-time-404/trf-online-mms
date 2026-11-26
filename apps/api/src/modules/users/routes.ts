import { protectedRoutes, jsonBody, uuid, type Database } from '../../http.ts';
import { createUsersService, userInput, userPatch } from './service.ts';

export function createUsersRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin, ['SUPER_ADMIN']);
  const service = createUsersService(db);
  app.get('/', async (c) => c.json(await service.list()));
  app.post('/', async (c) => c.json(await service.create(c.get('actor'), await jsonBody(userInput, c.req)), 201));
  app.put('/:id', async (c) => c.json(await service.update(c.get('actor'), uuid(c.req.param('id')), await jsonBody(userPatch, c.req))));
  app.delete('/:id', async (c) => c.json(await service.active(c.get('actor'), uuid(c.req.param('id')), false)));
  app.post('/:id/deactivate', async (c) => c.json(await service.active(c.get('actor'), uuid(c.req.param('id')), false)));
  app.post('/:id/enable', async (c) => c.json(await service.active(c.get('actor'), uuid(c.req.param('id')), true)));
  return app;
}
