import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { z } from 'zod';
import { userRoleSchema } from '@trf/shared';
import { found, type Database } from '../../http.ts';
import { writeAdminAudit } from '../../audit.ts';
import type { Actor } from '../../middleware/auth.ts';
import * as repo from './repository.ts';

export const userInput = z.object({ username: z.string().trim().min(1).max(128), email: z.email().max(254),
  role: userRoleSchema, department: z.string().max(200).nullable().optional(), employee_id: z.uuid().nullable().optional() }).strict();
export const userPatch = userInput.partial().refine((input) => Object.keys(input).length > 0, 'Tidak ada perubahan.');
export const createUsersService = (db: Database) => ({
  list: async () => (await repo.list(db)).map(repo.dto),
  create: async (actor: Actor, input: z.output<typeof userInput>) => {
    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await hash(temporaryPassword);
    return db.begin(async (tx) => {
      const user = found(await repo.insert(tx, input, passwordHash));
      await writeAdminAudit(tx, actor, 'USER', String(user.id), 'CREATE', null, user);
      return { user: repo.dto(user), temporaryPassword };
    });
  },
  update: async (actor: Actor, id: string, input: z.output<typeof userPatch>) => db.begin(async (tx) => {
    const before = found(await repo.find(tx, id, true));
    const user = found(await repo.update(tx, id, input));
    await writeAdminAudit(tx, actor, 'USER', id, 'UPDATE', before, user);
    return repo.dto(user);
  }),
  active: (actor: Actor, id: string, enabled: boolean) => db.begin(async (tx) => {
    const before = found(await repo.find(tx, id, true));
    const user = found(await repo.active(tx, id, enabled));
    await writeAdminAudit(tx, actor, 'USER', id, enabled ? 'ENABLE' : 'DEACTIVATE', before, user);
    return repo.dto(user);
  }),
});
