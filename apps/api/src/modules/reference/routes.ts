import { protectedRoutes, type Database } from '../../http.ts';
import { groupedReference } from './repository.ts';
export function createReferenceRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.get('/', async (c) => c.json(await groupedReference(db)));
  return app;
}
