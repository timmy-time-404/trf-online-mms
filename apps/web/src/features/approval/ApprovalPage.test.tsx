// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

const { handleApproval, fetchTRFs, getTRFsForApproval, auth } = vi.hoisted(() => ({
  handleApproval: vi.fn(), fetchTRFs: vi.fn(), getTRFsForApproval: vi.fn(),
  auth: { currentUser: { id: 'hod-1', role: 'HOD', department: 'HRMD' } },
}));
vi.mock('@/store', () => ({
  useTRFStore: () => ({ handleApproval, fetchTRFs, getTRFsForApproval }),
  useAuthStore: () => auth,
}));
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
import ApprovalPage from './ApprovalPage';

const trf = {
  id: 'trf-1', trfNumber: 'TRF-20261125-001', status: 'PENDING_APPROVAL', version: 3, department: 'HRMD',
  travelPurpose: '["BUSINESS_TRIP"]', startDate: '2026-12-20', endDate: '2026-12-22', travelArrangements: [],
  employee: { employeeName: 'Dummy EMPLOYEE' },
};

let container: HTMLDivElement;
let root: Root;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');
const button = (scope: ParentNode, label: string) =>
  [...scope.querySelectorAll('button')].find((b) => b.textContent?.trim() === label)!;
const type = (element: HTMLTextAreaElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
};

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  auth.currentUser.role = 'HOD';
  getTRFsForApproval.mockReturnValue([trf]);
  handleApproval.mockResolvedValue(true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<ApprovalPage />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it('asks HOD to confirm before approving and does nothing on cancel (#15)', async () => {
  await act(async () => button(container, 'Approve').click());
  expect(handleApproval).not.toHaveBeenCalled();
  expect(dialog()?.textContent).toContain('Konfirmasi approval TRF');
  expect(dialog()?.textContent).toContain('TRF-20261125-001');
  expect(dialog()?.textContent).toContain('Dummy EMPLOYEE');
  await act(async () => button(dialog()!, 'Cancel').click());
  expect(dialog()).toBeNull();
  expect(handleApproval).not.toHaveBeenCalled();
});

it('approves with the optional note after confirmation', async () => {
  await act(async () => button(container, 'Approve').click());
  await act(async () => type(dialog()!.querySelector('textarea')!, 'Sesuai jadwal site'));
  await act(async () => button(dialog()!, 'Approve').click());
  expect(handleApproval).toHaveBeenCalledWith('trf-1', auth.currentUser, 'APPROVE', 'Sesuai jadwal site', undefined, 3);
  expect(toast.success).toHaveBeenCalledWith('TRF TRF-20261125-001 berhasil disetujui.');
});

it('keeps the lumpsum dialog for HR', async () => {
  auth.currentUser.role = 'HR';
  await act(async () => root.render(<ApprovalPage />));
  await act(async () => button(container, 'Approve').click());
  expect(dialog()?.textContent).toContain('HR Approval & Lumpsum');
  expect(button(dialog()!, 'Approve & Save Lumpsum')).toBeTruthy();
  expect(handleApproval).not.toHaveBeenCalled();
});
