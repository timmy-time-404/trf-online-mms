import { z } from 'zod';
import { protectedRoutes, jsonBody, found, uuid, type Database } from '../../http.ts';
import { requireRole } from '../../middleware/auth.ts';
import { employeeDTO } from '../trf/repository.ts';
import * as repo from './repository.ts';
const fields = z.object({ employee_name: z.string().trim().min(1).max(200), department: z.string().min(1).max(200),
  section: z.string().max(200), job_title: z.string().max(200), phone: z.string().max(64) }).strict();
const createInput = fields.extend({ employee_code: z.string().trim().min(1).max(100) });
const patch = fields.partial().refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan.');
export function createEmployeesRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  // Active employee lists previously backed forms and lookups for every authenticated role.
  app.get('/', async (c) => c.json((await repo.list(db)).map(employeeDTO)));
  app.post('/', requireRole('HR', 'SUPER_ADMIN'), async (c) => c.json(employeeDTO(found(await repo.create(db, await jsonBody(createInput, c.req)))), 201));
  app.put('/:id', requireRole('HR', 'SUPER_ADMIN'), async (c) => c.json(employeeDTO(found(await repo.update(db, uuid(c.req.param('id')), await jsonBody(patch, c.req))))));
  app.delete('/:id', requireRole('HR', 'SUPER_ADMIN'), async (c) => c.json(found(await repo.deactivate(db, uuid(c.req.param('id'))))));
  return app;
}
