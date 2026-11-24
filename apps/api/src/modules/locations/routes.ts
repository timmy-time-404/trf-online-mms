import { z } from 'zod';
import { protectedRoutes, parse, type Database } from '../../http.ts';
import { search } from './repository.ts';
const query = z.object({ keyword: z.string().max(200).default(''), type: z.string().min(1).max(100) });
export function createLocationsRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.get('/', async (c) => { const input = parse(query, c.req.query()); return c.json(await search(db, input.keyword, input.type)); });
  return app;
}
