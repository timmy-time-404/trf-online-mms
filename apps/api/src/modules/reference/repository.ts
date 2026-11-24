import type { Database } from '../../http.ts';
export async function groupedReference(db: Database) {
  const rows = await db`select category,name from public.reference_master where is_active=true`;
  const result = { departments: [] as string[], purposes: [] as string[], transports: [] as string[], accommodations: [] as string[] };
  for (const row of rows) {
    if (row.category === 'DEPARTMENT') result.departments.push(row.name);
    if (row.category === 'TRAVEL_PURPOSE') result.purposes.push(row.name);
    if (row.category === 'TRANSPORT') result.transports.push(row.name);
    if (row.category === 'ACCOMMODATION') result.accommodations.push(row.name);
  }
  return result;
}
