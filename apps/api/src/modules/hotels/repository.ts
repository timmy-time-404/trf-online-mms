import type { Connection } from '../trf/repository.ts';
export interface HotelInput { name: string; totalRooms?: number | null }
export const dto = (row: Record<string, unknown>) => ({ id: row.id, name: row.name, totalRooms: row.total_rooms, createdAt: row.created_at });
export const list = (db: Connection) => db`select id,name,total_rooms,created_at from public.hotels order by name,id`;
export const find = async (db: Connection, id: string) => {
  const [row] = await db`select id,name,total_rooms,created_at from public.hotels where id=${id} for update`; return row;
};
export const create = async (db: Connection, input: HotelInput) => {
  const [row] = await db`insert into public.hotels(name,total_rooms) values (${input.name},${input.totalRooms ?? null}) returning *`; return row;
};
export const update = async (db: Connection, id: string, input: HotelInput) => {
  const [row] = await db`update public.hotels set name=${input.name},total_rooms=${input.totalRooms ?? null} where id=${id} returning *`; return row;
};
export const remove = async (db: Connection, id: string) => {
  const [row] = await db`delete from public.hotels where id=${id} returning id`; return row;
};
