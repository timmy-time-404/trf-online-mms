import type { TravelPurposeEntry } from '@/types';
import { getPurposeLabel } from '@/constants/travelPurposeOptions';

const genId = () => `purpose-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

/** Parse travelPurpose: bisa string (lama) atau JSON array (baru) */
export const parsePurposes = (raw: string | string[] | undefined): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    return [raw]; // plain string lama (e.g. "TRAINING")
  } catch {
    return [raw]; // plain string lama
  }
};

export const createEmptyPurposeEntry = (): TravelPurposeEntry => ({
  id            : genId(),
  travelPurpose : '[]',   // JSON array kosong
  startDate     : '',
  endDate       : '',
  purposeRemarks: '',
});

/** Human-readable purposes, e.g. '["BUSINESS_TRIP","TRAINING"]' -> "Business Trip, Training / Meeting". */
export const formatPurposes = (raw: string | string[] | undefined): string =>
  parsePurposes(raw).map(getPurposeLabel).join(', ') || '-';
