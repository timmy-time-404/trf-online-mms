import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { UserRole } from '@trf/shared';
import { requireRole, requireSession, type AuthEnv } from './middleware/auth.ts';
import type { openDatabase } from './db/connection.ts';

export type Database = ReturnType<typeof openDatabase>;
export function protectedRoutes(db: Database, origin: string, roles?: UserRole[]) {
  const app = new Hono<AuthEnv>();
  app.use('*', requireSession(db));
  if (roles) app.use('*', requireRole(...roles));
  app.use('*', async (c, next) => {
    if (!['GET', 'HEAD'].includes(c.req.method) && c.req.header('Origin') !== origin)
      return c.json({ message: 'Origin tidak diizinkan.' }, 403);
    await next();
  });
  app.use('*', bodyLimit({ maxSize: 64 * 1024, onError: (c) => c.json({ message: 'Data terlalu besar.' }, 413) }));
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ message: error.message }, error.status);
    const code = 'code' in error ? error.code : undefined;
    if (code === '23505') return c.json({ message: 'Data sudah digunakan.' }, 409);
    if (code === '23503') return c.json({ message: 'Data tertaut tidak ditemukan atau masih digunakan.' }, 409);
    console.error('API request failed.', error.name);
    return c.json({ message: 'Permintaan gagal. Silakan coba kembali.' }, 500);
  });
  return app;
}
export function parse<T extends z.ZodType>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (!result.success) {
    const issue = result.error.issues[0];
    throw new HTTPException(400, { message: issue?.code === 'unrecognized_keys' ? 'Kolom tidak diizinkan.' : issue?.message ?? 'Data tidak valid.' });
  }
  return result.data;
}
export async function jsonBody<T extends z.ZodType>(schema: T, request: { json: () => Promise<unknown> }) {
  return parse(schema, await request.json().catch(() => { throw new HTTPException(400, { message: 'JSON tidak valid.' }); }));
}
export const uuid = (value: string) => parse(z.uuid(), value);
export function found<T>(row: T | undefined): T {
  if (!row) throw new HTTPException(404, { message: 'Data tidak ditemukan.' });
  return row;
}
