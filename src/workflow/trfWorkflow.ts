import type { TRFStatus, UserRole } from '@/types';

export type WorkflowAction = 'APPROVE' | 'REJECT' | 'REVISE' | 'VERIFY';
export function getNextStatus(
  current: TRFStatus,
  role: UserRole,
  action: 'APPROVE' | 'VERIFY' | 'REJECT'
): TRFStatus {

  // ADMIN DEPT
  if (role === 'ADMIN_DEPT' && action === 'VERIFY') {
    if (current !== 'SUBMITTED')
      throw new Error('Invalid workflow');
    return 'PENDING_APPROVAL';
  }

  // HOD
  if (role === 'HOD' && action === 'APPROVE') {
    if (current !== 'PENDING_APPROVAL')
      throw new Error('Invalid workflow');
    return 'HOD_APPROVED';
  }

  // HR
  if (role === 'HR' && action === 'APPROVE') {
    if (current !== 'HOD_APPROVED')
      throw new Error('Invalid workflow');
    return 'HR_APPROVED';
  }

  // PM
  if (role === 'PM' && action === 'APPROVE') {
    if (current !== 'HR_APPROVED')
      throw new Error('Invalid workflow');
    return 'PM_APPROVED';
  }

  // GA
  if (role === 'GA' && action === 'APPROVE') {
    if (current !== 'PM_APPROVED')
      throw new Error('Invalid workflow');
    return 'GA_PROCESSED';
  }

  throw new Error('Action not allowed');
}