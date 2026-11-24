import type { TrfStatus, UserRole } from './domain.ts';
import { normalizeDepartment } from './business.ts';

export type WorkflowAction = 'APPROVE' | 'REJECT' | 'REVISE' | 'VERIFY';
export const MAIN_TRANSITIONS: Record<string, TrfStatus> = {
  ADMIN_DEPT_VERIFY_SUBMITTED: 'PENDING_APPROVAL',
  HOD_APPROVE_PENDING_APPROVAL: 'HOD_APPROVED',
  HR_APPROVE_HOD_APPROVED: 'HR_APPROVED',
  PM_APPROVE_HR_APPROVED: 'PM_APPROVED',
  GA_APPROVE_PM_APPROVED: 'GA_PROCESSED',
};
export const REVIEW_STATUSES: Record<UserRole, TrfStatus[]> = {
  ADMIN_DEPT: ['SUBMITTED'], HOD: ['PENDING_APPROVAL'], HR: ['HOD_APPROVED'],
  PM: ['HR_APPROVED'], GA: ['PM_APPROVED'], EMPLOYEE: [],
  SUPER_ADMIN: ['SUBMITTED', 'PENDING_APPROVAL', 'HOD_APPROVED', 'HR_APPROVED', 'PM_APPROVED'],
};
export function getNextStatus(current: TrfStatus, role: UserRole, action: WorkflowAction): TrfStatus {
  if (action === 'REJECT' || action === 'REVISE') {
    if (!REVIEW_STATUSES[role]?.includes(current)) throw new Error(`${action} not allowed: ${current} → ${role}`);
    return action === 'REJECT' ? 'REJECTED' : 'NEEDS_REVISION';
  }
  const next = MAIN_TRANSITIONS[`${role}_${action}_${current}`];
  if (!next) throw new Error(`Invalid workflow: ${current} → ${role} → ${action}`);
  return next;
}

interface Approver { role: string; department?: string | null; is_active?: boolean | null }
export function findNextActiveStatus(target: string, _users: Approver[], _department?: string | null): TrfStatus {
  // D2: retain the waiting stage even if its approver is unavailable.
  // Keep the legacy selector signature for existing callers.
  void _users; void _department;
  return target as TrfStatus;
}
export function missingApprover(status: string, users: Approver[], department?: string | null) {
  const role = ({ SUBMITTED:'ADMIN_DEPT', PENDING_APPROVAL:'HOD', HOD_APPROVED:'HR', HR_APPROVED:'PM', PM_APPROVED:'GA' } as Record<string,string>)[status];
  return role && !users.some((user) => user.role===role && user.is_active!==false &&
    (!['ADMIN_DEPT','HOD'].includes(role) || !!normalizeDepartment(department) && normalizeDepartment(user.department)===normalizeDepartment(department))) ? role : null;
}
