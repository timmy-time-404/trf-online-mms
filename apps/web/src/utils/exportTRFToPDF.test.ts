import { describe, expect, it } from 'vitest';
import type { TRF } from '@/types';
import { buildHTML } from './exportTRFToPDF';

const payload = '<img src=x onerror="alert(1)">';

describe('TRF PDF template', () => {
  it('escapes user-entered text instead of rendering it as HTML', () => {
    const trf = {
      id: 'trf-1', trfNumber: 'TRF-20261125-001', status: 'SUBMITTED',
      employee: { employeeName: payload, phone: payload, email: payload },
      accommodations: [{ hotelName: payload, checkIn: '2026-11-25', checkOut: '2026-11-26', remarks: payload }],
      travelArrangements: [{ date: '2026-11-25', fromLocation: payload, toLocation: payload, remarks: payload }],
      lumpsumNote: payload,
      pmApproval: { approverName: payload },
    } as unknown as TRF;

    const html = buildHTML(trf);

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('onerror="');
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  });
});
