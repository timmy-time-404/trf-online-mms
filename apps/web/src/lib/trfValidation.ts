import type { TravelPurposeEntry } from '@/types';
import { TRAVEL_PURPOSE_OPTIONS } from '@/constants/travelPurposeOptions';

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function hasValidPurposes(value: string): boolean {
  let purposes: unknown;
  try {
    purposes = JSON.parse(value);
  } catch {
    purposes = [value]; // Older requests store a single purpose key.
  }
  return Array.isArray(purposes) && purposes.length > 0 && purposes.every(
    (key) => TRAVEL_PURPOSE_OPTIONS.some((option) => option.key === key),
  );
}

export function validateTravelPurposeEntries(entries: TravelPurposeEntry[]): string | null {
  if (entries.length === 0) return 'Harap isi minimal satu tujuan perjalanan.';
  for (let i = 0; i < entries.length; i++) {
    const p = entries[i];
    if (!hasValidPurposes(p.travelPurpose)) {
      return `Travel Purpose #${i + 1}: Harap pilih tujuan perjalanan.`;
    }
    if (!p.startDate || !p.endDate) {
      return `Travel Purpose #${i + 1}: Harap isi tanggal mulai dan selesai.`;
    }
    if (!isCalendarDate(p.startDate) || !isCalendarDate(p.endDate)) {
      return `Travel Purpose #${i + 1}: Tanggal perjalanan tidak valid.`;
    }
    if (p.endDate < p.startDate) {
      return `Travel Purpose #${i + 1}: Tanggal selesai tidak boleh sebelum tanggal mulai.`;
    }
    if (!p.purposeRemarks?.trim()) {
      return `Travel Purpose #${i + 1}: Remarks / Catatan wajib diisi.`;
    }
  }
  return null;
}
