/**
 * Characterization tests for legacy store rules (docs/spec/roles.md, docs/spec/trf-workflow.md).
 * They describe what the system does today, including behavior the owner has not yet decided to change.
 */
import { beforeEach, describe, expect, it } from 'vitest';


import { useTRFStore } from './index';
import type { Employee, TRF, TRFStatus, User, UserRole } from '@/types';

const trf = (id: string, status: TRFStatus, department: string, employeeId = 'emp-a'): TRF => ({
  id, trfNumber: id, employeeId, department, status,
  travelPurpose: 'TRAINING', startDate: '2026-12-01', endDate: '2026-12-02', travelArrangements: [],
  createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z',
});

const user = (role: UserRole, extra: Partial<User> = {}): User => ({
  id: `user-${role}`, username: role.toLowerCase(), email: `${role}@example.test`, role, ...extra,
});

const employee = (id: string, userId: string): Employee => ({
  id, userId, employeeCode: id, employeeType: 'EMPLOYEE', employeeName: id, jobTitle: '-',
  department: 'Survey', section: '-', email: '-', phone: '-', pointOfHire: '-',
});

const TRFS = [
  trf('t1', 'SUBMITTED', 'Survey', 'emp-a'),
  trf('t2', 'PENDING_APPROVAL', ' survey ', 'emp-b'),
  trf('t3', 'HOD_APPROVED', 'Geotechnical', 'emp-c'),
  trf('t4', 'HR_APPROVED', 'Survey', 'emp-a'),
  trf('t5', 'PM_APPROVED', 'HRMD', 'emp-c'),
];

beforeEach(() => {
  useTRFStore.setState({
    trfs: TRFS,
    employees: [employee('emp-a', 'user-EMPLOYEE')],
    users: [],
  });
});

const ids = (list: TRF[]) => list.map((t) => t.id);

describe('TRF visibility per role', () => {
  const visible = (u: User) => ids(useTRFStore.getState().getVisibleTRFs(u));

  it('shows an employee only their own requests, resolving the employee via the account link', () => {
    expect(visible(user('EMPLOYEE'))).toEqual(['t1', 't4']);
  });

  it('shows nothing to an employee account without a linked employee', () => {
    useTRFStore.setState({ employees: [] });
    expect(visible(user('EMPLOYEE'))).toEqual([]);
  });

  it('limits ADMIN_DEPT and HOD to their department, ignoring case and surrounding spaces', () => {
    expect(visible(user('ADMIN_DEPT', { department: 'SURVEY' }))).toEqual(['t1', 't2', 't4']);
    expect(visible(user('HOD', { department: 'survey' }))).toEqual(['t1', 't2', 't4']);
    expect(visible(user('HOD'))).toEqual([]);
  });

  it('shows every request to HR, PM, GA and SUPER_ADMIN', () => {
    for (const role of ['HR', 'PM', 'GA', 'SUPER_ADMIN'] as const) {
      expect(visible(user(role))).toEqual(['t1', 't2', 't3', 't4', 't5']);
    }
  });
});

describe('work queues', () => {
  it('gives ADMIN_DEPT submitted requests of their department only', () => {
    expect(ids(useTRFStore.getState().getTRFsForVerification('Survey'))).toEqual(['t1']);
    expect(ids(useTRFStore.getState().getTRFsForVerification(''))).toEqual([]);
  });

  it('gives each approver the status that waits for them', () => {
    const { getTRFsForApproval } = useTRFStore.getState();
    expect(ids(getTRFsForApproval('HOD', 'Survey'))).toEqual(['t2']);
    expect(ids(getTRFsForApproval('HR'))).toEqual(['t3']);
    expect(ids(getTRFsForApproval('PM'))).toEqual(['t4']);
    expect(ids(getTRFsForApproval('SUPER_ADMIN'))).toEqual([]);
  });

  it('gives GA every PM-approved request', () => {
    expect(ids(useTRFStore.getState().getTRFsForProcessing())).toEqual(['t5']);
  });
});

// D2: the owner removed automatic stage skipping. Preserve these cases with the new expectations.
describe('approver availability policy (D2)', () => {
  const next = (target: TRFStatus) => useTRFStore.getState().findNextActiveStatus(target, 'Survey');

  it('skips every remaining stage when no user list is loaded, retaining the waiting stage (D2)', () => {
    expect(next('PENDING_APPROVAL')).toBe('PENDING_APPROVAL');
  });

  it('stops at the first stage that has an active approver', () => {
    useTRFStore.setState({ users: [user('HR')] });
    expect(next('PENDING_APPROVAL')).toBe('PENDING_APPROVAL');
  });

  it('treats inactive users as missing', () => {
    useTRFStore.setState({ users: [user('HOD', { is_active: false }), user('HR')] });
    expect(next('PENDING_APPROVAL')).toBe('PENDING_APPROVAL');
  });

  it('retains the stage when only an HOD from another department exists (D2/D6)', () => {
    useTRFStore.setState({ users: [user('HOD', { department: 'Geotechnical' })] });
    expect(next('PENDING_APPROVAL')).toBe('PENDING_APPROVAL');
  });
});
