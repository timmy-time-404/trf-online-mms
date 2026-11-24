/**
 * Characterization test: locks the legacy transition table (docs/spec/trf-workflow.md).
 * If this fails, the workflow changed. Update the spec and this table together, on purpose.
 */
import { expect, it } from 'vitest';
import type { TRFStatus, UserRole } from '@/types';
import { getNextStatus, type WorkflowAction } from './trfWorkflow';

const ROLES: UserRole[] = ['EMPLOYEE', 'ADMIN_DEPT', 'HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'];
const ACTIONS: WorkflowAction[] = ['VERIFY', 'APPROVE', 'REJECT', 'REVISE'];
// D9: CANCELLED is terminal for approval actions; existing transition assertions stay.
const STATUSES: TRFStatus[] = [
  'DRAFT', 'SUBMITTED', 'ADMIN_DEPT_VERIFIED', 'PENDING_APPROVAL', 'HOD_APPROVED', 'HR_APPROVED',
  'PM_APPROVED', 'CANCELLED', 'GA_PROCESSED', 'REJECTED', 'NEEDS_REVISION', 'REVISED',
];

const allowedTransitions = () => {
  const rows: string[] = [];
  for (const role of ROLES)
    for (const action of ACTIONS)
      for (const status of STATUSES) {
        try {
          rows.push(`${role} ${action} ${status} -> ${getNextStatus(status, role, action)}`);
        } catch {
          // Not allowed: getNextStatus throws for every illegal combination.
        }
      }
  return rows;
};

it('allows exactly the legacy transitions and nothing else', () => {
  expect(allowedTransitions()).toEqual([
    'ADMIN_DEPT VERIFY SUBMITTED -> PENDING_APPROVAL',
    'ADMIN_DEPT REJECT SUBMITTED -> REJECTED',
    'ADMIN_DEPT REVISE SUBMITTED -> NEEDS_REVISION',
    'HOD APPROVE PENDING_APPROVAL -> HOD_APPROVED',
    'HOD REJECT PENDING_APPROVAL -> REJECTED',
    'HOD REVISE PENDING_APPROVAL -> NEEDS_REVISION',
    'HR APPROVE HOD_APPROVED -> HR_APPROVED',
    'HR REJECT HOD_APPROVED -> REJECTED',
    'HR REVISE HOD_APPROVED -> NEEDS_REVISION',
    'PM APPROVE HR_APPROVED -> PM_APPROVED',
    'PM REJECT HR_APPROVED -> REJECTED',
    'PM REVISE HR_APPROVED -> NEEDS_REVISION',
    'GA APPROVE PM_APPROVED -> GA_PROCESSED',
    'GA REJECT PM_APPROVED -> REJECTED',
    'GA REVISE PM_APPROVED -> NEEDS_REVISION',
    'SUPER_ADMIN REJECT SUBMITTED -> REJECTED',
    'SUPER_ADMIN REJECT PENDING_APPROVAL -> REJECTED',
    'SUPER_ADMIN REJECT HOD_APPROVED -> REJECTED',
    'SUPER_ADMIN REJECT HR_APPROVED -> REJECTED',
    'SUPER_ADMIN REJECT PM_APPROVED -> REJECTED',
    'SUPER_ADMIN REVISE SUBMITTED -> NEEDS_REVISION',
    'SUPER_ADMIN REVISE PENDING_APPROVAL -> NEEDS_REVISION',
    'SUPER_ADMIN REVISE HOD_APPROVED -> NEEDS_REVISION',
    'SUPER_ADMIN REVISE HR_APPROVED -> NEEDS_REVISION',
    'SUPER_ADMIN REVISE PM_APPROVED -> NEEDS_REVISION',
  ]);
});
