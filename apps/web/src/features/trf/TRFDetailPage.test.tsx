// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { toast } from 'sonner';

const { deleteTRF, getTRFById, navigate, fetchAllData } = vi.hoisted(() => ({
  deleteTRF: vi.fn(), getTRFById: vi.fn(), navigate: vi.fn(), fetchAllData: vi.fn(),
}));
vi.mock('@/store', () => ({ useTRFStore: () => ({ deleteTRF, getTRFById, fetchAllData }), useAuthStore: () => ({currentUser:{employeeId:'employee'}}) }));
vi.mock('react-router-dom', () => ({ useParams: () => ({ id: 'draft-1' }), useNavigate: () => navigate }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('./components/TRFDetailView', () => ({ default: ({ onDelete }: { onDelete: () => void }) => <button onClick={onDelete}>Delete</button> }));
vi.mock('./components/ExportTRFButton', () => ({ default: () => null }));
vi.mock('@/components/common/ConfirmDialog', () => ({
  default: ({ open, loading, onConfirm }: { open: boolean; loading: boolean; onConfirm: () => void }) =>
    open ? <button disabled={loading} onClick={onConfirm}>Confirm delete</button> : null,
}));
import TRFDetailPage from './TRFDetailPage';

let container: HTMLDivElement;
let root: Root;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  getTRFById.mockReturnValue({ id: 'draft-1', trfNumber: 'TRF-1', status: 'DRAFT' });
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root.render(<TRFDetailPage />));
  await act(async () => container.querySelector('button')!.click());
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it('keeps the user on the detail page and reports a failed deletion', async () => {
  deleteTRF.mockResolvedValue(false);
  await act(async () => container.querySelectorAll('button')[1].click());
  expect(toast.error).toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  expect(container.querySelectorAll('button')[1].disabled).toBe(false);
});

it('waits for confirmation from the database before showing success or navigating', async () => {
  let finish!: (success: boolean) => void;
  deleteTRF.mockReturnValue(new Promise<boolean>((resolve) => { finish = resolve; }));
  await act(async () => container.querySelectorAll('button')[1].click());
  expect(container.querySelectorAll('button')[1].disabled).toBe(true);
  expect(toast.success).not.toHaveBeenCalled();
  expect(navigate).not.toHaveBeenCalled();
  await act(async () => finish(true));
  expect(toast.success).toHaveBeenCalledOnce();
  expect(navigate).toHaveBeenCalledWith('/trf');
});
