import type postgres from 'postgres';
import type { Actor } from '../../middleware/auth.ts';
import type { Connection, TrfRow } from './repository.ts';

export const activeApprovers = (sql: Connection) => sql<{ role: string; department: string | null }[]>`
  select role,department from public.users where is_active is distinct from false`;

export const saveWorkflow = async (sql: Connection, row: TrfRow, payload: Record<string, postgres.SerializableParameter>) => {
  const [changed] = await sql<TrfRow[]>`update public.trfs set ${sql(payload)}
    where id=${row.id} and status=${row.status} returning *`;
  return changed;
};

export const enqueueNotification = (sql: Connection, row: TrfRow, actor: Actor,
  status: string, remarks: string, editedOnly: boolean) => sql`
    insert into public.notification_outbox(trf_id,recipient_phone,template_key,payload)
    values (${row.id},${row.employee?.phone ?? null},${editedOnly ? 'TRF_EDITED' : 'TRF_STATUS_CHANGED'},
      ${sql.json({ trfId: row.id, trfNumber: row.trf_number, employeeName: row.employee?.employee_name ?? 'Employee',
        oldStatus: row.status, newStatus: status, actorId: actor.id, actorName: actor.displayName, remarks, editedOnly })})`;

export const notifyOwner = (sql: Connection, row: TrfRow, actor: Actor, note: string) => sql`
  insert into public.notifications(user_id,trf_id,trf_number,title,message,created_by,created_by_name)
  select u.id,${row.id},${row.trf_number},
    ${actor.role === 'HR' ? `TRF ${row.trf_number} diperbarui & disetujui oleh HR` : `TRF ${row.trf_number} diedit oleh GA`},
    ${note.trim() || (actor.role === 'HR'
      ? `${actor.displayName} (HR) telah memperbarui dan menyetujui TRF ini.`
      : `${actor.displayName} (GA) memperbarui detail TRF ini. TRF masih menunggu proses dokumen (voucher/tiket) sebelum final disetujui.`)},
    ${actor.id},${actor.displayName}
  from public.users u where u.id=${row.employee?.user_id ?? null}`;
