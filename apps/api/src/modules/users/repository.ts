import type { Connection } from '../trf/repository.ts';
import type { z } from 'zod';
import type { userInput } from './service.ts';

// Explicit projection shared by every user-management response; never SELECT *.
export const publicColumns = ['id', 'username', 'email', 'role', 'department', 'employee_id', 'is_active', 'must_change_password', 'created_at'];
export const list = (sql: Connection) => sql`select ${sql(publicColumns)} from public.users order by created_at desc,id`;
export const find = async (sql: Connection, id: string, lock = false) => {
  const [row] = await sql`select ${sql(publicColumns)} from public.users where id=${id} ${lock ? sql`for update` : sql``}`;
  return row;
};
export const insert = async (sql: Connection, input: z.output<typeof userInput>, passwordHash: string) => {
  const [row] = await sql`insert into public.users ${sql({ username: input.username, email: input.email,
    role: input.role, department: input.department ?? null, employee_id: input.employee_id ?? null,
    is_active: true, must_change_password: true, password_hash: passwordHash })} returning ${sql(publicColumns)}`;
  return row;
};
export const update = async (sql: Connection, id: string, input: Partial<z.output<typeof userInput>>) => {
  const [row] = await sql`update public.users set ${sql(input)} where id=${id} returning ${sql(publicColumns)}`;
  return row;
};
export const active = async (sql: Connection, id: string, enabled: boolean) => {
  const [row] = await sql`update public.users set is_active=${enabled} where id=${id} returning ${sql(publicColumns)}`;
  if (row && !enabled) await sql`update public.app_sessions set revoked_at=now(),revoke_reason='USER_DEACTIVATED'
    where user_id=${id} and revoked_at is null`;
  return row;
};
export function dto(row: Record<string, unknown>) {
  return { id: row.id, username: row.username, email: row.email, role: row.role,
    department: row.department ?? undefined, employeeId: row.employee_id ?? undefined,
    is_active: row.is_active, isActive: row.is_active, mustChangePassword: row.must_change_password,
    createdAt: row.created_at };
}
