import type { TRF, UserRole } from '@/types';

export type ApprovalAction =
  | 'APPROVE'
  | 'REJECT'
  | 'REVISE'
  | null;

export interface ApprovalPermission {
  canApprove: boolean;
  canReject: boolean;
  canRevise: boolean;
}

/**
 * CENTRAL APPROVAL RULES
 * UI hanya membaca ini
 */
export const getApprovalPermission = (
  trf: TRF,
  role: UserRole
): ApprovalPermission => {

  switch (role) {

    case 'HOD':
      if (trf.status === 'ADMIN_DEPT_VERIFIED')
        return { canApprove: true, canReject: true, canRevise: true };
      break;

    case 'HR':
      if (trf.status === 'HOD_APPROVED')
        return { canApprove: true, canReject: true, canRevise: true };
      break;

    case 'PM':
      if (trf.status === 'HR_APPROVED')
        return { canApprove: true, canReject: true, canRevise: false };
      break;
  }

  return {
    canApprove: false,
    canReject: false,
    canRevise: false
  };
};