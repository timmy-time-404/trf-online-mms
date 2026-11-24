import type { Database } from '../../http.ts';
export const list = (db: Database, userId: string) => db`select * from public.notifications
  where user_id=${userId} order by created_at desc,id desc limit 50`;
export const markRead = async (db: Database, userId: string, id: string) => {
  const [row] = await db`update public.notifications set is_read=true where id=${id} and user_id=${userId} returning *`;
  return row;
};
export const markAllRead = (db: Database, userId: string) => db`update public.notifications
  set is_read=true where user_id=${userId} and is_read=false`;
export const dto = (row: Record<string, unknown>) => ({ id: row.id, userId: row.user_id,
  trfId: row.trf_id ?? undefined, trfNumber: row.trf_number ?? undefined, title: row.title, message: row.message,
  isRead: row.is_read, createdBy: row.created_by ?? undefined, createdByName: row.created_by_name ?? undefined, createdAt: row.created_at });
