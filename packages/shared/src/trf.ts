import { z } from 'zod';
import { isUrgent } from './business.ts';

export const TRAVEL_PURPOSE_KEYS = [
  'ANNUAL_LEAVE', 'FIELD_BREAK', 'TRAINING', 'BUSINESS_TRIP', 'INBOUND', 'OUTBOUND',
  'NEW_HIRE_INBOUND', 'SICK_LEAVE', 'UNPAID_LEAVE', 'CUTI_BAPTIS_KHITANAN', 'CUTI_BESAR',
  'CUTI_HAID', 'CUTI_KEGUGURAN', 'CUTI_MELAHIRKAN_ISTRI', 'CUTI_MELAHIRKAN_WANITA',
  'CUTI_MENIKAH', 'CUTI_MENIKAHKAN_ANAK', 'CUTI_MENINGGAL_KELUARGA_BESAR',
  'CUTI_MENINGGAL_KELUARGA_INTI', 'CUTI_NAIK_HAJI', 'CUTI_PANJANG', 'OTHERS',
] as const;
function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function hasValidPurposes(value: string): boolean {
  let purposes: unknown;
  try { purposes = JSON.parse(value); } catch { purposes = [value]; }
  return Array.isArray(purposes) && purposes.length > 0 && purposes.every(
    (key) => TRAVEL_PURPOSE_KEYS.some((allowed) => allowed === key),
  );
}
const purposeEntrySchema = z.object({
  id: z.string(), travelPurpose: z.string(), startDate: z.string(), endDate: z.string(),
  purposeRemarks: z.string().optional(),
});
export const travelPurposeEntriesSchema = z.array(purposeEntrySchema).superRefine((entries, ctx) => {
  const add = (message: string, index?: number) => ctx.addIssue({ code: 'custom', message, path: index === undefined ? [] : [index] });
  if (!entries.length) { add('Harap isi minimal satu tujuan perjalanan.'); return; }
  for (const [i, p] of entries.entries()) {
    const prefix = `Travel Purpose #${i + 1}: `;
    if (!hasValidPurposes(p.travelPurpose)) { add(prefix + 'Harap pilih tujuan perjalanan.', i); return; }
    if (!p.startDate || !p.endDate) { add(prefix + 'Harap isi tanggal mulai dan selesai.', i); return; }
    if (!isCalendarDate(p.startDate) || !isCalendarDate(p.endDate)) { add(prefix + 'Tanggal perjalanan tidak valid.', i); return; }
    if (p.endDate < p.startDate) { add(prefix + 'Tanggal selesai tidak boleh sebelum tanggal mulai.', i); return; }
    if (!p.purposeRemarks?.trim()) { add(prefix + 'Remarks / Catatan wajib diisi.', i); return; }
  }
});
export function validateTravelPurposeEntries(entries: z.input<typeof travelPurposeEntriesSchema>): string | null {
  const result = travelPurposeEntriesSchema.safeParse(entries);
  return result.success ? null : result.error.issues[0]?.message ?? 'Data tujuan perjalanan tidak valid.';
}
const accommodationSchema = z.object({
  hotelName: z.string(), checkInDate: z.string(), checkOutDate: z.string(), remarks: z.string().optional(),
});
const arrangementSchema = z.object({
  id: z.string().optional(), travelType: z.enum(['TRAVEL_IN', 'TRAVEL_OUT']),
  arrangementType: z.enum(['BY_SITE_SERVICE', 'SELF_ARRANGEMENT']),
  transportation: z.enum(['FLIGHT', 'TRAIN', 'CAR', 'SHIP', 'SELF_ARRANGEMENT']),
  travelDate: z.string(), fromLocation: z.string(), toLocation: z.string(),
  specialArrangement: z.boolean(), justification: z.string().optional(), remarks: z.string().optional(),
});
const trfFields = z.object({
  employeeId: z.uuid(), department: z.string().optional(), travelPurpose: z.string(),
  startDate: z.string(), endDate: z.string(), purposeRemarks: z.string().optional(),
  lateSubmissionReason: z.string().max(4000).optional(),
  purposeEntries: z.array(purposeEntrySchema).optional(),
  accommodation: accommodationSchema.optional(), accommodations: z.array(accommodationSchema).optional(),
  travelArrangements: z.array(arrangementSchema),
}).strict();
export const trfPatchSchema = trfFields.partial();
// D9: a draft can contain incomplete purpose/date fields, but always has an owner.
export const draftTRFSchema = trfFields.partial().extend({ employeeId: z.uuid(),
  startDate: z.string().refine((v)=>!v || isCalendarDate(v),'Tanggal mulai tidak valid.').optional(),
  endDate: z.string().refine((v)=>!v || isCalendarDate(v),'Tanggal selesai tidak valid.').optional(),
});
export const createTRFSchema = trfFields.superRefine((input, ctx) => {
  const entries = input.purposeEntries ?? [{ id: 'legacy', ...input }];
  const result = travelPurposeEntriesSchema.safeParse(entries);
  if (!result.success) for (const issue of result.error.issues) ctx.addIssue({ code: 'custom', message: issue.message, path: ['purposeEntries', ...issue.path] });
  if (isUrgent(entries[0]?.startDate) && !input.lateSubmissionReason?.trim())
    ctx.addIssue({ code: 'custom', message: 'Alasan keterlambatan wajib untuk pengajuan kurang dari H-14.', path: ['lateSubmissionReason'] });
}).transform((input) => {
  // Modern entries are authoritative; legacy columns mirror the first entry.
  const first = input.purposeEntries?.[0];
  return first ? { ...input, travelPurpose: first.travelPurpose, startDate: first.startDate,
    endDate: first.endDate, purposeRemarks: first.purposeRemarks } : input;
});
export type CreateTRF = z.infer<typeof createTRFSchema>;
