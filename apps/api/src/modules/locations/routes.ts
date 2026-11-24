import { z } from 'zod';
import { protectedRoutes, parse, type Database } from '../../http.ts';
import { search, searchArrangement } from './repository.ts';

const list = (max: number) => z.string().max(500).default('')
  .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean).slice(0, max));
const query = z.object({
  keyword: z.string().max(200).default(''),
  type: z.string().min(1).max(100).optional(),
  types: list(10),
  provinces: list(20),
}).refine((q) => q.type || q.types.length, { message: 'Tipe lokasi wajib diisi.' });

export function createLocationsRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  app.get('/', async (c) => {
    const input = parse(query, c.req.query());
    return c.json(input.types.length
      ? await searchArrangement(db, input.keyword.trim(), input.types, input.provinces)
      : await search(db, input.keyword, input.type!));
  });
  return app;
}
