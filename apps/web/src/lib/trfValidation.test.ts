import { describe, expect, it } from 'vitest';
import { validateTravelPurposeEntries } from './trfValidation';
import type { TravelPurposeEntry } from '@/types';

const entry: TravelPurposeEntry = {
  id: 'purpose-1', travelPurpose: '["TRAINING"]',
  startDate: '2026-11-18', endDate: '2026-11-19', purposeRemarks: 'Pelatihan keselamatan',
};

describe('TRF purpose validation', () => {
  it('accepts current multi-select and legacy single-purpose values', () => {
    expect(validateTravelPurposeEntries([entry])).toBeNull();
    expect(validateTravelPurposeEntries([{ ...entry, travelPurpose: 'TRAINING' }])).toBeNull();
  });

  it('rejects a form with no purpose entries', () => {
    expect(validateTravelPurposeEntries([])).not.toBeNull();
  });

  it.each(['[]', '', ' ', '["UNKNOWN"]', '[null]', '{}', 'null', '["TRAINING", 1]'])('rejects missing or invalid choices: %s', (travelPurpose) => {
    expect(validateTravelPurposeEntries([{ ...entry, travelPurpose }])).not.toBeNull();
  });

  it('rejects an end date earlier than the start, including when start was changed later', () => {
    expect(validateTravelPurposeEntries([{ ...entry, endDate: '2026-11-17' }])).not.toBeNull();
  });

  it.each(['2026-02-30', '2026-13-01', 'not-a-date', '18/11/2026'])('rejects invalid calendar date: %s', (startDate) => {
    expect(validateTravelPurposeEntries([{ ...entry, startDate }])).not.toBeNull();
  });

  it('accepts same-day travel and valid leap-day travel', () => {
    expect(validateTravelPurposeEntries([{ ...entry, endDate: entry.startDate }])).toBeNull();
    expect(validateTravelPurposeEntries([{ ...entry, startDate: '2028-02-29', endDate: '2028-03-01' }])).toBeNull();
  });

  it('reports which entry needs a required remark', () => {
    expect(validateTravelPurposeEntries([entry, { ...entry, purposeRemarks: '  ' }])).toContain('#2');
  });
});
