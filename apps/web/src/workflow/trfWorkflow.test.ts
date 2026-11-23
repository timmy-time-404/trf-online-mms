import { expect, it } from 'vitest';
import { getNextStatus } from './trfWorkflow';

it('keeps the normal verification and approval transitions', () => {
  expect(getNextStatus('SUBMITTED', 'ADMIN_DEPT', 'VERIFY')).toBe('PENDING_APPROVAL');
  expect(getNextStatus('PENDING_APPROVAL', 'HOD', 'APPROVE')).toBe('HOD_APPROVED');
  expect(getNextStatus('HOD_APPROVED', 'HR', 'APPROVE')).toBe('HR_APPROVED');
  expect(getNextStatus('HR_APPROVED', 'PM', 'APPROVE')).toBe('PM_APPROVED');
  expect(getNextStatus('PM_APPROVED', 'GA', 'APPROVE')).toBe('GA_PROCESSED');
});

it('allows a pending request to be returned by its current reviewer', () => {
  expect(getNextStatus('SUBMITTED', 'ADMIN_DEPT', 'REVISE')).toBe('NEEDS_REVISION');
  expect(getNextStatus('PENDING_APPROVAL', 'HOD', 'REVISE')).toBe('NEEDS_REVISION');
  expect(getNextStatus('HOD_APPROVED', 'HR', 'REVISE')).toBe('NEEDS_REVISION');
  expect(getNextStatus('HR_APPROVED', 'PM', 'REVISE')).toBe('NEEDS_REVISION');
});

it('rejects revisions by an employee or the wrong approval stage', () => {
  expect(() => getNextStatus('SUBMITTED', 'EMPLOYEE', 'REVISE')).toThrow();
  expect(() => getNextStatus('HR_APPROVED', 'HOD', 'REVISE')).toThrow();
});

it('does not reopen completed or rejected requests through revise', () => {
  expect(() => getNextStatus('GA_PROCESSED', 'HR', 'REVISE')).toThrow();
  expect(() => getNextStatus('REJECTED', 'SUPER_ADMIN', 'REVISE')).toThrow();
});
