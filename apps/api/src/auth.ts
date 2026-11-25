import { createHash, randomBytes } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { openDatabase } from './db/connection.ts';

type Database = ReturnType<typeof openDatabase>;
const COOKIE = '__Host-trf-session';
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const loginSchema = z.object({ username: z.string().trim().min(1).max(128), password: z.string().min(1).max(256) });
interface Account {
  id: string; username: string; email: string; role: string;
  employee_id: string | null; department: string | null;
  is_active: boolean; must_change_password: boolean; password_hash: string | null;
}
const publicUser = (user: Account) => ({
  id: user.id, username: user.username, email: user.email, role: user.role,
  employeeId: user.employee_id, department: user.department,
  isActive: user.is_active, mustChangePassword: user.must_change_password,
});
const cookieOptions = { path: '/', secure: true, httpOnly: true, sameSite: 'Lax' as const };

export const createAuthRoutes = (db: Database, origin: string) => {
  const routes = new Hono();
  const dummyHash = hash(randomBytes(32));
  let activeLogins = 0;
  routes.use('*', bodyLimit({ maxSize: 4096, onError: (c) => c.json({ message: 'Request terlalu besar.' }, 413) }));
  routes.use('*', async (c, next) => {
    c.header('Cache-Control', 'no-store');
    if (!['GET', 'HEAD'].includes(c.req.method) && c.req.header('Origin') !== origin) {
      return c.json({ message: 'Origin tidak diizinkan.' }, 403);
    }
    await next();
  });

  routes.post('/login', async (c) => {
    const parsed = loginSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ message: 'Username dan password tidak valid.' }, 400);
    if (activeLogins >= 8) return c.json({ message: 'Silakan coba beberapa saat lagi.' }, 429);
    activeLogins++;
    try {
      const { username, password } = parsed.data;
      const identifier = digest(username.toLowerCase());
      // Cloudflare sets this header; without it the per-IP limit is skipped (see deploy notes).
      const clientIp = c.req.header('CF-Connecting-IP')?.trim();
      const ipHash = clientIp ? digest(clientIp) : null;
      // Short transaction: check limits and reserve the attempt as failed, so concurrent
      // requests cannot exceed the limit. Argon2 runs outside it, holding no lock or connection.
      const reserved = await db.begin(async (tx) => {
        await tx`select pg_advisory_xact_lock(${parseInt(identifier.slice(0, 8), 16) | 0})`;
        const [attempts] = await tx`select
            count(*) filter (where identifier_hash=${identifier}) as by_user,
            count(*) filter (where ${ipHash}::text is not null and ip_hash=${ipHash}) as by_ip
          from public.app_login_attempts
          where not succeeded and attempted_at > now() - interval '15 minutes'
            and (identifier_hash=${identifier} or (${ipHash}::text is not null and ip_hash=${ipHash}))`;
        if (Number(attempts?.by_user) >= 10 || Number(attempts?.by_ip) >= 30) return null;
        const [row] = await tx<{ id: string }[]>`insert into public.app_login_attempts(identifier_hash, ip_hash, succeeded, failure_reason)
          values (${identifier}, ${ipHash}, false, 'INVALID_CREDENTIALS') returning id`;
        return row!.id;
      });
      const [user] = reserved ? await db<Account[]>`select * from public.users where username=${username}` : [];
      const valid = reserved ? await verify(user?.password_hash ?? await dummyHash, password).catch(() => false) : false;
      const result = !reserved ? { limited: true } as const
        : !(valid && user?.is_active === true) || !user ? { denied: true } as const
        : await db.begin(async (tx) => {
          await tx`update public.app_login_attempts set succeeded=true, failure_reason=null, user_id=${user.id}
            where id=${reserved}`;
          const token = randomBytes(32).toString('base64url');
          const [session] = await tx`insert into public.app_sessions(user_id, token_hash, expires_at)
            values (${user.id}, ${digest(token)}, now() + interval '30 minutes') returning expires_at`;
          return { user: publicUser(user), token, expiresAt: session?.expires_at };
        });
      if (reserved && 'denied' in result && user) {
        await db`update public.app_login_attempts set user_id=${user.id} where id=${reserved}`;
      }
      if ('limited' in result) return c.json({ message: 'Terlalu banyak percobaan. Coba lagi setelah 15 menit.' }, 429);
      if ('denied' in result) return c.json({ message: 'Username atau password salah.' }, 401);
      // Rotate any previous session without returning the session secret to JavaScript.
      const previous = getCookie(c, COOKIE);
      if (previous) await db`update public.app_sessions set revoked_at=now(), revoke_reason='LOGIN_ROTATED'
        where token_hash=${digest(previous)} and revoked_at is null`;
      setCookie(c, COOKIE, result.token, { ...cookieOptions, maxAge: 1800 });
      return c.json({ user: result.user, expiresAt: result.expiresAt });
    } finally { activeLogins--; }
  });

  routes.get('/me', async (c) => {
    const token = getCookie(c, COOKIE);
    if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token)) return c.json({ message: 'Sesi tidak tersedia.' }, 401);
    const [user] = await db<Account[]>`select u.* from public.app_sessions s join public.users u on u.id=s.user_id
      where s.token_hash=${digest(token)} and s.revoked_at is null and s.expires_at > now()
      and s.created_at > now() - interval '12 hours' and u.is_active=true`;
    if (!user) {
      deleteCookie(c, COOKIE, cookieOptions);
      return c.json({ message: 'Sesi berakhir.' }, 401);
    }
    const [session] = await db`update public.app_sessions set last_used_at=now(),
      expires_at=least(now() + interval '30 minutes', created_at + interval '12 hours')
      where token_hash=${digest(token)} and revoked_at is null and expires_at > now() returning expires_at`;
    if (!session) return c.json({ message: 'Sesi berakhir.' }, 401);
    setCookie(c, COOKIE, token, { ...cookieOptions, expires: new Date(session.expires_at) });
    return c.json({ user: publicUser(user), expiresAt: session.expires_at });
  });

  routes.post('/logout', async (c) => {
    const token = getCookie(c, COOKIE);
    if (token) await db`update public.app_sessions set revoked_at=now(), revoke_reason='LOGOUT'
      where token_hash=${digest(token)} and revoked_at is null`;
    deleteCookie(c, COOKIE, cookieOptions);
    return c.json({ success: true });
  });
  routes.onError((_error, c) => {
    console.error('Authentication request failed.');
    return c.json({ message: 'Layanan login sedang bermasalah.' }, 500);
  });
  return routes;
};
