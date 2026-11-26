import { z } from 'zod';
import { protectedRoutes, jsonBody, found, uuid, type Database } from '../../http.ts';
import { requireRole } from '../../middleware/auth.ts';
import { employeeDTO } from '../trf/repository.ts';
import { writeAdminAudit } from '../../audit.ts';
import * as repo from './repository.ts';
const fields = z.object({ employee_name: z.string().trim().min(1).max(200), department: z.string().min(1).max(200),
  section: z.string().max(200), job_title: z.string().max(200), phone: z.string().max(64) }).strict();
const createInput = fields.extend({ employee_code: z.string().trim().min(1).max(100) });
const patch = fields.partial().refine((value) => Object.keys(value).length > 0, 'Tidak ada perubahan.');
export function createEmployeesRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin);
  // Active employee lists previously backed forms and lookups for every authenticated role.
  app.get('/', async (c) => c.json((await repo.list(db,c.get('actor'))).map(employeeDTO)));
  app.post('/', requireRole('HR', 'SUPER_ADMIN'), async (c) => {
    const input = await jsonBody(createInput, c.req);
    const row = await db.begin(async (tx) => {
      const created = found(await repo.create(tx, input));
      await writeAdminAudit(tx, c.get('actor'), 'EMPLOYEE', String(created.id), 'CREATE', null, created);
      return created;
    });
    return c.json(employeeDTO(row), 201);
  });
  app.put('/:id', requireRole('HR', 'SUPER_ADMIN'), async (c) => {
    const id = uuid(c.req.param('id'));
    const input = await jsonBody(patch, c.req);
    const row = await db.begin(async (tx) => {
      const before = found(await repo.find(tx, id));
      const changed = found(await repo.update(tx, id, input));
      await writeAdminAudit(tx, c.get('actor'), 'EMPLOYEE', id, 'UPDATE', before, changed);
      return changed;
    });
    return c.json(employeeDTO(row));
  });
  app.delete('/:id', requireRole('HR', 'SUPER_ADMIN'), async (c) => {
    const id = uuid(c.req.param('id'));
    return c.json(await db.begin(async (tx) => {
      const before = found(await repo.find(tx, id));
      const row = found(await repo.deactivate(tx, id));
      await writeAdminAudit(tx, c.get('actor'), 'EMPLOYEE', id, 'DEACTIVATE', before, { ...before, is_active: false });
      return row;
    }));
  });
  return app;
}
