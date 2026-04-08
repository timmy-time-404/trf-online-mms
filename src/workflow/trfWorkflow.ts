import type { TRFStatus, UserRole } from '@/types';

export type WorkflowAction = 'APPROVE' | 'REJECT' | 'REVISE' | 'VERIFY';

export function getNextStatus(
  current: TRFStatus,
  role: UserRole,
  action: WorkflowAction
): TRFStatus {

  // =============================
  // 🔴 REJECT (VALIDATED)
  // =============================
  if (action === 'REJECT') {
    const allowedReject: Record<UserRole, TRFStatus[]> = {
      ADMIN_DEPT: ['SUBMITTED'],
      HOD: ['PENDING_APPROVAL'],
      HR: ['HOD_APPROVED'],
      PM: ['HR_APPROVED'],
      GA: ['PM_APPROVED'],
      EMPLOYEE: [],
      SUPER_ADMIN: ['SUBMITTED','PENDING_APPROVAL','HOD_APPROVED','HR_APPROVED','PM_APPROVED']
    };

    if (!allowedReject[role]?.includes(current)) {
      throw new Error(`❌ Reject not allowed: ${current} → ${role}`);
    }

    return 'REJECTED';
  }

  // =============================
  // 🟡 REVISE
  // =============================
  if (action === 'REVISE') {
    return 'NEEDS_REVISION';
  }

  // =============================
  // 🔵 MAIN FLOW
  // =============================
  const flow: Record<string, TRFStatus> = {
    'ADMIN_DEPT_VERIFY_SUBMITTED': 'PENDING_APPROVAL',
    'HOD_APPROVE_PENDING_APPROVAL': 'HOD_APPROVED',
    'HR_APPROVE_HOD_APPROVED': 'HR_APPROVED',
    'PM_APPROVE_HR_APPROVED': 'PM_APPROVED',
    'GA_APPROVE_PM_APPROVED': 'GA_PROCESSED'
  };

  const key = `${role}_${action}_${current}`;
  const next = flow[key];

  if (!next) {
    throw new Error(`❌ Invalid workflow: ${current} → ${role} → ${action}`);
  }

  return next;
}