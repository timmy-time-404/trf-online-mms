import { HTTPException } from 'hono/http-exception';
import type { Actor } from '../../middleware/auth.ts';

export const normalizeDepartment = (value: string | null | undefined) => value?.trim().toLowerCase() ?? '';
export const canSeeTRF = (actor: Actor, trf: { employee_id: string; department: string | null }) => {
  switch (actor.role) {
    case 'EMPLOYEE': return !!actor.employeeId && trf.employee_id === actor.employeeId;
    case 'ADMIN_DEPT': case 'HOD': return !!normalizeDepartment(actor.department)
      && normalizeDepartment(actor.department) === normalizeDepartment(trf.department);
    case 'HR': case 'PM': case 'GA': case 'SUPER_ADMIN': return true;
  }
};
export function assertCanEdit(actor: Actor, trf: { employee_id: string; status: string }) {
  if (actor.role !== 'SUPER_ADMIN' && (actor.role !== 'EMPLOYEE' || actor.employeeId !== trf.employee_id)) {
    throw new HTTPException(403, { message: 'TRF hanya dapat diedit pemiliknya.' });
  }
}
export function assertStatus(status: string, allowed: string[]) {
  if (!allowed.includes(status)) throw new HTTPException(409, { message: 'Status TRF sudah berubah atau tidak mengizinkan tindakan ini.' });
}
