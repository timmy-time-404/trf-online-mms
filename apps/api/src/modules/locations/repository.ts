import type { Database } from '../../http.ts';
export const search = (db: Database, keyword: string, type: string) => db`
  select id,name,type,province,code,city,is_active,priority from public.locations
  where name ilike ${'%' + keyword + '%'} and type=${type} limit 10`;
