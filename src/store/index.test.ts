import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, from, enabled } = vi.hoisted(() => {
  const query = {
    delete: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(), maybeSingle: vi.fn(),
    then: undefined,
  };
  return { query, from: vi.fn(() => query), enabled: vi.fn(() => true) };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from }, isSupabaseEnabled: enabled }));
vi.mock('@/lib/notifyStatusChangeWA', () => ({ notifyEmployeeStatusChangeWA: vi.fn() }));

import { useTRFStore } from './index';
import type { TRF } from '@/types';

const draft: TRF = {
  id: 'draft-1', trfNumber: 'TRF-1', employeeId: 'employee-1', status: 'DRAFT',
  travelPurpose: 'TRAINING', startDate: '2026-11-18', endDate: '2026-11-19',
  travelArrangements: [],
  createdAt: '2026-11-18T00:00:00Z', updatedAt: '2026-11-18T00:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  enabled.mockReturnValue(true);
  useTRFStore.setState({ trfs: [draft, { ...draft, id: 'draft-2' }] });
});

describe('delete TRF', () => {
  it('reports database rejection and retains the cached request', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: { message: 'Access denied' } });
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(useTRFStore.getState().trfs).toHaveLength(2);
  });

  it('does not report success when no draft was deleted (RLS, changed status, or missing row)', async () => {
    query.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(useTRFStore.getState().trfs).toHaveLength(2);
  });

  it('only removes the request after the database confirms deletion', async () => {
    query.maybeSingle.mockResolvedValue({ data: { id: draft.id }, error: null });
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(true);
    expect(query.eq).toHaveBeenCalledWith('status', 'DRAFT');
    expect(useTRFStore.getState().trfs.map((trf) => trf.id)).toEqual(['draft-2']);
  });

  it('reports unexpected transport failures without deleting local data', async () => {
    query.maybeSingle.mockRejectedValue(new Error('Connection lost'));
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(useTRFStore.getState().trfs).toHaveLength(2);
  });

  it('does not claim deletion when backend is unavailable', async () => {
    enabled.mockReturnValue(false);
    expect(await useTRFStore.getState().deleteTRF(draft.id)).toBe(false);
    expect(from).not.toHaveBeenCalled();
  });
});
