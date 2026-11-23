import { describe, expect, it } from 'vitest';
import { createTRFSchema } from './trf';

const input = { employeeId: '00000000-0000-4000-8000-000000000001', travelPurpose: 'TRAINING',
  startDate: '2026-12-01', endDate: '2026-12-02', purposeRemarks: 'Training', travelArrangements: [] };
describe('TRF input', () => {
  it('accepts legacy fields and rejects status injection', () => {
    expect(createTRFSchema.safeParse(input).success).toBe(true);
    expect(createTRFSchema.safeParse({ ...input, status: 'PM_APPROVED' }).success).toBe(false);
  });
  it('validates all modern entries and mirrors the first in legacy columns', () => {
    const first = { id: 'entry-1', travelPurpose: 'BUSINESS_TRIP', startDate: '2026-12-04',
      endDate: '2026-12-05', purposeRemarks: 'Meeting' };
    expect(createTRFSchema.parse({ ...input, purposeEntries: [first] })).toMatchObject(firstWithoutId(first));
    expect(createTRFSchema.safeParse({ ...input, purposeEntries: [first, { ...first, id: 'entry-2', purposeRemarks: ' ' }] }).success).toBe(false);
  });
});
function firstWithoutId(entry: { travelPurpose: string; startDate: string; endDate: string; purposeRemarks: string }) {
  return { travelPurpose: entry.travelPurpose, startDate: entry.startDate, endDate: entry.endDate, purposeRemarks: entry.purposeRemarks };
}
