import { beforeEach, describe, expect, it, vi } from 'vitest';

const { request } = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('@/api/client', () => ({ apiRequest: request }));
vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn() }, isSupabaseEnabled: () => false }));
vi.mock('@/lib/notifyStatusChangeWA', () => ({ notifyEmployeeStatusChangeWA: vi.fn() }));

import { useAuthStore, useTRFStore } from './index';
import type { TRF } from '@/types';

const draft: TRF = {
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
    expect(request).toHaveBeenCalledWith('/trfs/' + draft.id, { method: 'DELETE' });
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
