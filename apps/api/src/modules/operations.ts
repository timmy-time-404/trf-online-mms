import { z } from 'zod';
import type postgres from 'postgres';
import { HTTPException } from 'hono/http-exception';
import type { UserRole } from '@trf/shared';
import type { Actor } from '../middleware/auth.ts';
import { found, parse, type Database } from '../http.ts';

export type Transaction = postgres.TransactionSql;
export const text = z.string().trim().min(1);
export const optionalText = z.string().trim().nullish().transform((v) => v || null);
export const date = z.iso.date();
export const optionalId = z.preprocess((v) => v === '' ? null : v, z.uuid().nullish().transform((v) => v ?? null));
export const today = () => new Date().toISOString().slice(0, 10);
export function authorize(actor: Actor, roles: readonly UserRole[]) {
  if (!roles.includes(actor.role)) throw new HTTPException(403, { message: 'Akses ditolak untuk peran ini.' });
}
export async function requireChangedPassword(db: Database, actor: Actor) {
  const [user] = await db`select must_change_password from public.users where id=${actor.id} and is_active=true`;
  if (!user) throw new HTTPException(401, { message: 'Sesi berakhir.' });
  if (user.must_change_password) throw new HTTPException(403, { message: 'Ubah temporary password sebelum melanjutkan.' });
}

// Function and argument names are supplied only by server-owned definitions, never request data.
export async function rpc(tx: Transaction, name: string, args: Record<string, unknown>, table = false) {
  if (!/^[a-z_]+$/.test(name) || Object.keys(args).some((key) => !/^p_[a-z0-9_]+$/.test(key))) throw new Error('Invalid RPC definition');
  try {
    const entries = Object.entries(args);
    const call = `public.${name}(${entries.map(([key], i) => `${key} => $${i + 1}`).join(',')})`;
    const execute = (connection: Transaction) => connection.unsafe(table ? `select * from ${call}` : `select ${call} as result`,
      entries.map(([, v]) => v) as Parameters<Transaction['unsafe']>[1]);
    for (let attempt = 0; ; attempt++) {
      try {
        // The legacy linked-TRF generator has 900 random suffixes per day.
        // A savepoint retries only that collision without losing the outer history/outbox transaction.
        const rows = name === 'pm_approve_early_recall_request' ? await tx.savepoint(execute) : await execute(tx);
        return table ? rows : rows[0]?.result;
      } catch (error) {
        const collision = error && typeof error === 'object' && 'code' in error && error.code === '23505'
          && 'constraint_name' in error && error.constraint_name === 'trfs_trf_number_key';
        if (name !== 'pm_approve_early_recall_request' || !collision || attempt >= 4) throw error;
      }
    }
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
    if (code === '42501') throw new HTTPException(403, { message: 'Akses ditolak.' });
    if (code === 'P0002') throw new HTTPException(404, { message: 'Data tidak ditemukan.' });
    if (code === '23505' || code === '55000') throw new HTTPException(409, { message: 'Data sudah diproses atau berubah.' });
    // Legacy routines use P0001 for both business validation and status errors.
    if (code === '22003') throw new HTTPException(400, { message: 'Saldo OS tidak cukup atau jumlah melampaui batas.' });
    if (code === '22023' || code === '22007' || code === '22008' || code === '23514' || code === 'P0001')
      throw new HTTPException(400, { message: 'Data tidak sesuai aturan proses. Periksa tanggal, referensi, dan status terkait.' });
    throw error;
  }
}
export function actionBody<T extends Record<string, readonly UserRole[]>>(value: unknown, roles: T, actor: Actor): { action: keyof T & string; body: Record<string, unknown> } {
  const body = parse(z.record(z.string(), z.unknown()), value);
  const action = parse(text, body.action);
  if (!Object.hasOwn(roles, action)) throw new HTTPException(400, { message: 'Action tidak valid.' });
  authorize(actor, roles[action]!);
  return { action, body };
}
export async function lockRecall(tx: Transaction, id: string) {
  const before = found((await tx`select * from public.early_recall_requests where id=${id}`)[0]);
  const current = found((await tx`select * from public.early_recall_requests where id=${id} for update`)[0]);
  if (before.status !== current.status || String(before.updated_at) !== String(current.updated_at))
    throw new HTTPException(409, { message: 'Early Recall berubah. Muat ulang data.' });
  return current;
}
