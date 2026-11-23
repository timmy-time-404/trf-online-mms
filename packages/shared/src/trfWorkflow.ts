import type { TrfStatus, UserRole } from './domain.ts';

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
export function findNextActiveStatus(target: string, users: Approver[], department?: string | null): TrfStatus | 'APPROVED' {
  const stages: Record<string, { role: string; next: string }> = {
    PENDING_APPROVAL: { role: 'HOD', next: 'HOD_APPROVED' },
    HOD_APPROVED: { role: 'HR', next: 'HR_APPROVED' },
    HR_APPROVED: { role: 'PM', next: 'PM_APPROVED' },
    PM_APPROVED: { role: 'GA', next: 'APPROVED' },
  };
  let current = target;
  for (let i = 0; i < 5; i++) {
    const stage = stages[current];
    if (!stage || users.some((user) => user.role === stage.role && user.is_active !== false
      && (stage.role !== 'ADMIN_DEPT' || user.department === department))) break;
    current = stage.next;
  }
  // Preserve the legacy terminal APPROVED value, including its policy gap.
  return current as TrfStatus | 'APPROVED';
}
