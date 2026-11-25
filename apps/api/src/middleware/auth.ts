import { createHash } from 'node:crypto';
import { createMiddleware } from 'hono/factory';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { userRoleSchema, type UserRole } from '@trf/shared';
import type { openDatabase } from '../db/connection.ts';

export interface Actor {
  id: string; role: UserRole; department: string | null; employeeId: string | null;
  username: string; displayName: string;
}
export type AuthEnv = { Variables: { actor: Actor } };
// A user who still has an HR-issued temporary password may only change it (the UI enforces the
// same); otherwise anyone who knows the temporary password could act as that employee.
export const requireSession = (db: ReturnType<typeof openDatabase>, { allowTemporaryPassword = false } = {}) =>
  createMiddleware<AuthEnv>(async (c, next) => {
  c.header('Cache-Control', 'no-store');
  const token = getCookie(c, '__Host-trf-session');
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return c.json({ message: 'Sesi tidak tersedia.' }, 401);
  const digest = createHash('sha256').update(token).digest('hex');
  const [row] = await db`update public.app_sessions s set last_used_at=now(),
    expires_at=least(now()+interval '30 minutes', s.created_at+interval '12 hours')
    from public.users u left join public.employees e on e.id=u.employee_id
      left join public.employees linked on linked.user_id=u.id
    where s.user_id=u.id and s.token_hash=${digest} and s.revoked_at is null
      and s.expires_at>now() and s.created_at>now()-interval '12 hours' and u.is_active=true
    returning u.id,u.role,u.department,coalesce(u.employee_id,linked.id) as employee_id,
      u.username,coalesce(e.employee_name,linked.employee_name,u.username) as display_name,s.expires_at,
      u.must_change_password`;
  const role = userRoleSchema.safeParse(row?.role);
  if (!row || !role.success) {
    deleteCookie(c, '__Host-trf-session', { path: '/', secure: true, httpOnly: true, sameSite: 'Lax' });
    return c.json({ message: 'Sesi berakhir.' }, 401);
  }
  if (row.must_change_password && !allowTemporaryPassword) {
    return c.json({ message: 'Ubah temporary password sebelum melanjutkan.' }, 403);
  }
  c.set('actor', { id: row.id, role: role.data, department: row.department, employeeId: row.employee_id,
    username: row.username, displayName: row.display_name });
  setCookie(c, '__Host-trf-session', token, { path: '/', secure: true, httpOnly: true, sameSite: 'Lax', expires: new Date(row.expires_at) });
  await next();
});
export const requireRole = (...roles: UserRole[]) => createMiddleware<AuthEnv>(async (c, next) => {
  if (!roles.includes(c.get('actor').role)) return c.json({ message: 'Akses ditolak untuk peran ini.' }, 403);
  await next();
});
