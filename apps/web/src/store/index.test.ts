import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/api/client', () => ({ apiRequest: request }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() }, isSupabaseEnabled: () => false }));
vi.mock('@/lib/notifyStatusChangeWA', () => ({ notifyEmployeeStatusChangeWA: vi.fn() }));

import { useAuthStore, useTRFStore } from './index';
import type { TRF } from '@/types';
import { gaProcessTRF, saveHRLumpsum } from './supabaseStore';

// D13: adapter fixtures carry the version displayed to the user.
const draft: TRF = {
  version: 1,
  id: 'draft-1', trfNumber: 'TRF-1', employeeId: 'employee-1', status: 'DRAFT',
  travelPurpose: 'TRAINING', startDate: '2026-11-18', endDate: '2026-11-19',
  travelArrangements: [],
  createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();

  useTRFStore.setState({ trfs: [draft, { ...draft, id: 'draft-2' }] });
});

describe('delete TRF', () => {
  it('reports database rejection and retains the cached request', async () => {
    request.mockRejectedValue(new Error('Access denied'));
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(useTRFStore.getState().trfs).toHaveLength(2);
  });

  it('does not report success when no draft was deleted (RLS, changed status, or missing row)', async () => {
    request.mockResolvedValue({});
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(useTRFStore.getState().trfs).toHaveLength(2);
  });

  it('only removes the request after the database confirms deletion', async () => {
    request.mockResolvedValue({ id: draft.id });
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(true);
    expect(request).toHaveBeenCalledWith('/trfs/' + draft.id, { method: 'DELETE', version: 1 });
    expect(useTRFStore.getState().trfs.map((trf) => trf.id)).toEqual(['draft-2']);
  });

  it('reports unexpected transport failures without deleting local data', async () => {
    request.mockRejectedValue(new Error('Connection lost'));
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(useTRFStore.getState().trfs).toHaveLength(2);
  });

  it('does not claim deletion when backend is unavailable', async () => {
    request.mockRejectedValue(new Error('Backend unavailable'));
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(request).toHaveBeenCalledTimes(1);
  });
});

it('clears business data when a session becomes invalid', () => {
  useAuthStore.getState().invalidateSession();
  expect(useTRFStore.getState().trfs).toEqual([]);
  expect(useTRFStore.getState().employees).toEqual([]);
});

describe('workflow API adapters', () => {
  const reviewer = { id: 'reviewer', username: 'hr', email: 'hr@example.invalid', role: 'HR' as const };
  it('sends verification NO with optional remarks to the verify endpoint', async () => {
    request.mockResolvedValue({ ...draft, status: 'NEEDS_REVISION' });
    expect(await useTRFStore.getState().handleVerify(draft.id, reviewer, 'REVISE')).toBe(true);
    expect(request).toHaveBeenCalledWith('/trfs/draft-1/verify', { method: 'POST', version: 1, body: { decision: 'NO', remarks: undefined } });
  });
  it('sends HR approval and lumpsum together without trusting the caller identity', async () => {
    request.mockResolvedValue({ ...draft, status: 'HR_APPROVED', lumpsumAmount: 75_000 });
    expect(await useTRFStore.getState().handleApproval(draft.id, reviewer, 'APPROVE', 'Approved', { amount: 75_000, note: 'Travel' })).toBe(true);
    expect(request).toHaveBeenCalledOnce();
    expect(request).toHaveBeenCalledWith('/trfs/draft-1/approve', { method: 'POST', version: 1, body: { remarks: 'Approved', lumpsum: { amount: 75_000, note: 'Travel' } } });
    expect(useTRFStore.getState().trfs[0]?.status).toBe('HR_APPROVED');
  });
  it('sends HR edit and approval as one request', async () => {
    request.mockResolvedValue({ ...draft, status: 'HR_APPROVED' });
    const updates = { purposeRemarks: 'Edited' }, lumpsum = { amount: 150_000, note: '' };
    expect(await useTRFStore.getState().editAndApproveTRF(draft.id, reviewer, updates, 'Note', lumpsum)).toBe(true);
    expect(request).toHaveBeenCalledWith('/trfs/draft-1/edit-approve', { method: 'POST', version: 1, body: { updates, note: 'Note', lumpsum } });
  });
  it('retains cached data when approval fails', async () => {
    request.mockRejectedValue(new Error('HTTP 409'));
    expect(await useTRFStore.getState().handleApproval(draft.id, reviewer, 'APPROVE')).toBe(false);
    expect(useTRFStore.getState().trfs[0]?.status).toBe('DRAFT');
  });
  it('does not restore data after session invalidation while approval is in flight', async () => {
    useAuthStore.setState({ currentUser: reviewer });
    let resolve!: (trf: TRF) => void;
    request.mockReturnValue(new Promise<TRF>((done) => { resolve = done; }));
    const pending = useTRFStore.getState().handleApproval(draft.id, reviewer, 'APPROVE');
    useAuthStore.getState().invalidateSession();
    resolve({ ...draft, status: 'HR_APPROVED' });
    expect(await pending).toBe(false);
    expect(useTRFStore.getState().trfs).toEqual([]);
  });
  it('processes through the API; documents are uploaded separately (WP5)', async () => {
    request.mockResolvedValue({ ...draft, status: 'GA_PROCESSED' });
    expect(await gaProcessTRF(draft.id, 'spoofed', 'spoofed', { transportation: 'Car' }, 'Done',1)).toBe(true);
    expect(request).toHaveBeenCalledWith('/trfs/draft-1/process', { method: 'POST', version: 1, body: {
      voucherDetails: { transportation: 'Car' }, remarks: 'Done',
    } });
  });
  it('keeps the old lumpsum helper as an atomic HR approval adapter', async () => {
    request.mockResolvedValue({ ...draft, status: 'HR_APPROVED' });
    await saveHRLumpsum(draft.id, 75_000, 'Travel', 'spoofed','',1);
    expect(request).toHaveBeenCalledWith('/trfs/draft-1/approve', { method: 'POST', version: 1, body: { remarks: '', lumpsum: { amount: 75_000, note: 'Travel' } } });
  });
});
