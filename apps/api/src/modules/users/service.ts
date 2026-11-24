import { randomBytes } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import { z } from 'zod';
import { userRoleSchema } from '@trf/shared';
import { found, type Database } from '../../http.ts';
import * as repo from './repository.ts';

export const userInput = z.object({ username: z.string().trim().min(1).max(128), email: z.email().max(254),
  role: userRoleSchema, department: z.string().max(200).nullable().optional(), employee_id: z.uuid().nullable().optional() }).strict();
export const userPatch = userInput.partial().refine((input) => Object.keys(input).length > 0, 'Tidak ada perubahan.');
export const createUsersService = (db: Database) => ({
  list: async () => (await repo.list(db)).map(repo.dto),
  create: async (input: z.output<typeof userInput>) => {
    const temporaryPassword = randomBytes(18).toString('base64url');
    const passwordHash = await hash(temporaryPassword);
    const user = found(await repo.insert(db, input, passwordHash));
    return { user: repo.dto(user), temporaryPassword };
  },
  update: async (id: string, input: z.output<typeof userPatch>) => repo.dto(found(await repo.update(db, id, input))),
  active: (id: string, enabled: boolean) => db.begin(async (tx) => repo.dto(found(await repo.active(tx, id, enabled)))),
});
