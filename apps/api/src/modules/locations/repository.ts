import type { Database } from '../../http.ts';

// Escape LIKE wildcards so user input is matched literally.
const like = (keyword: string) => `%${keyword.replace(/[\\%_]/g, '\\$&')}%`;

/** Legacy combobox search: one type, name match (store.searchLocations). */
export const search = (db: Database, keyword: string, type: string) => db`
  select id,name,type,province,code,city,is_active,priority from public.locations
  where name ilike ${like(keyword)} and type=${type} limit 10`;

/**
 * Travel arrangement search (TravelArrangementSection): active locations of any of
 * the given types, optional province limit, matching name/code/city/province.
 */
export const searchArrangement = (db: Database, keyword: string, types: string[], provinces: string[]) => db`
  select id,name,type,code,city,province,priority,is_active from public.locations
  where is_active = true and type = any(${types})
    ${provinces.length ? db`and province = any(${provinces})` : db``}
    ${keyword.length >= 2 ? db`and (name ilike ${like(keyword)} or code ilike ${like(keyword)}
      or city ilike ${like(keyword)} or province ilike ${like(keyword)})` : db``}
  order by priority asc, name asc limit 10`;
