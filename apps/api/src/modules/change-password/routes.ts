import { createHash } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import { jsonBody, protectedRoutes, type Database } from '../../http.ts';

export function createChangePasswordRoutes(db: Database, origin: string) {
  const app = protectedRoutes(db, origin, undefined, undefined, true);
  app.post('/', async (c) => {
    const body = await jsonBody(z.object({ currentPassword: z.string().min(1).max(256), newPassword: z.string().min(8).max(128)
      .regex(/[A-Za-z]/).regex(/\d/) }).strict(), c.req);
    const actor = c.get('actor');
    const digest = createHash('sha256').update(getCookie(c, '__Host-trf-session')!).digest('hex');
    const attemptKey = createHash('sha256').update('CHANGE_PASSWORD:' + actor.id).digest('hex');
    const user = await db.begin(async (tx) => {
      // Match login/reset lock order, including their concurrent session creation.
      const [current] = await tx`select * from public.users where id=${actor.id} and is_active=true for update`;
      const [session] = await tx`select id from public.app_sessions where token_hash=${digest} and user_id=${actor.id}
        and revoked_at is null and expires_at>now() and created_at>now()-interval '12 hours' for update`;
      if (!current || !session) throw new HTTPException(401, { message: 'Sesi berakhir.' });
      await tx`select pg_advisory_xact_lock(hashtextextended(${'CHANGE_PASSWORD:' + actor.id},0))`;
      const [attempt] = await tx`select count(*)::int as total from public.app_login_attempts
        where identifier_hash=${attemptKey} and not succeeded and attempted_at>now()-interval '15 minutes'`;
      if (attempt?.total >= 10) return { limited: true } as const;
      if (!await verify(current.password_hash ?? '', body.currentPassword).catch(() => false)) {
        await tx`insert into public.app_login_attempts(identifier_hash,user_id,succeeded,failure_reason)
          values (${attemptKey},${actor.id},false,'INVALID_CREDENTIALS')`;
        return { denied: true } as const;
      }
      const passwordHash = await hash(body.newPassword);
      await tx`select public.change_application_password(${actor.id},${session.id},${current.password_hash},${passwordHash})`;
      const [updated] = await tx`select id,username,email,role,employee_id,department,is_active from public.users where id=${actor.id}`;
      return { id: updated!.id, username: updated!.username, email: updated!.email, role: updated!.role,
        employeeId: updated!.employee_id, department: updated!.department, isActive: updated!.is_active, mustChangePassword: false };
    });
    if ('limited' in user) return c.json({ message: 'Terlalu banyak percobaan. Coba lagi setelah 15 menit.' }, 429);
    if ('denied' in user) return c.json({ message: 'Password saat ini tidak benar.' }, 400);
    return c.json({ success: true, user });
  });
  return app;
}
