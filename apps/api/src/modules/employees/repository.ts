import type { Actor } from '../../middleware/auth.ts';
import { employeeScope } from '../trf/repository.ts';
import type { Connection } from '../trf/repository.ts';
export const list = (sql: Connection, actor: Actor) => sql`select id,user_id,employee_code,employee_name,employee_type,
  department,section,job_title,email,phone,point_of_hire,join_date::text,employee_level
  from public.employees where is_active=true and ${employeeScope(sql,actor)} order by employee_name,id`;
export const create = async (sql: Connection, fields: Record<string, string>) => {
  const [row] = await sql`insert into public.employees ${sql(fields)} returning *`; return row;
};
export const update = async (sql: Connection, id: string, fields: Record<string, string>) => {
  const [row] = await sql`update public.employees set ${sql(fields)} where id=${id} returning *`; return row;
};
export const deactivate = async (sql: Connection, id: string) => {
  const [row] = await sql`update public.employees set is_active=false where id=${id} returning id`; return row;
};
