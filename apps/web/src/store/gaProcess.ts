import { apiRequest } from '@/api/client';
import type { GAProcess, TRF } from '@/types';

/** GA marks a TRF processed; the API requires at least one uploaded document (D4). */
export const gaProcessTRF = async (
  id: string, _gaId: string, _gaName: string,
  voucherDetails: GAProcess['voucherDetails'], remarks: string, version?: number,
): Promise<boolean> => {
  await apiRequest<TRF>('/trfs/' + encodeURIComponent(id) + '/process', {
    method: 'POST', version: version ?? 0, body: { voucherDetails, remarks },
  });
  return true;
};
