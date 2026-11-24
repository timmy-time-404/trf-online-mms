import { normalizeDepartment } from '@trf/shared';
import type { Actor } from '../../middleware/auth.ts';
import type { Database } from '../../http.ts';
export interface DashboardRow extends Record<string, unknown> {
  id: string; status: string; start_date: string; end_date: string;
  travel_arrangements: { travelType?: string; travelDate?: string }[] | null;
}
export function visibleRows(db: Database, actor: Actor) {
  // D6: dashboard and TRF list use the same department key.
  const scope = actor.role === 'EMPLOYEE' ? db`employee_id=${actor.employeeId}`
    : actor.role === 'ADMIN_DEPT' || actor.role === 'HOD'
      ? db`${!!normalizeDepartment(actor.department)} and public.normalize_department(department)=${normalizeDepartment(actor.department)}` : db`true`;
  return db<DashboardRow[]>`select id,status,start_date::text,end_date::text,travel_arrangements from public.trfs where ${scope}`;
}
