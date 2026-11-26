import { normalizeDepartment } from '@trf/shared';
import type { Actor } from '../../middleware/auth.ts';
import type { Database } from '../../http.ts';
export interface DashboardRow extends Record<string, unknown> {
  id: string; status: string; start_date: string; end_date: string;
  travel_arrangements: { travelType?: string; travelDate?: string }[] | null;
}
/** Rows the stats use: only GA_PROCESSED TRFs count (see dashboardStats). */
export const processedRows = (db: Database, actor: Actor) => visibleRows(db, actor, db`status='GA_PROCESSED'`);
/** Rows with at least one travel date inside the 7-day week starting at `weekStart`. */
export const weekRows = (db: Database, actor: Actor, weekStart: string) => visibleRows(db, actor, db`exists (
  select 1 from jsonb_array_elements(case when jsonb_typeof(travel_arrangements)='array' then travel_arrangements else '[]'::jsonb end) a
  where a->>'travelDate' >= ${weekStart} and a->>'travelDate' < to_char(${weekStart}::date + 7,'YYYY-MM-DD'))`);
export function visibleRows(db: Database, actor: Actor, filter = db`true`) {
  // D6: dashboard and TRF list use the same department key.
  const scope = actor.role === 'EMPLOYEE' ? db`employee_id=${actor.employeeId}`
    : actor.role === 'ADMIN_DEPT' || actor.role === 'HOD'
      ? db`${!!normalizeDepartment(actor.department)} and public.normalize_department(department)=${normalizeDepartment(actor.department)}` : db`true`;
  return db<DashboardRow[]>`select id,status,start_date::text,end_date::text,travel_arrangements from public.trfs where ${scope} and ${filter}`;
}
