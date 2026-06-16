/**
 * TravelPurposeSection.tsx  (FINAL — multi-checkbox per entry)
 *
 * Perubahan dari versi sebelumnya:
 * - Ganti Select (single) → grid checkbox (multi-select)
 * - entry.travelPurpose sekarang string[] bukan string
 *   TAPI untuk backward compat DB kita simpan sebagai JSON string di field
 *   travelPurpose: JSON.stringify([...]) dan parse saat baca
 * - Di EntryCard setiap purpose tampil sebagai checkbox grid 3 kolom
 */

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Target, Calendar, Plus, Trash2 } from 'lucide-react';
import type { TravelPurposeEntry } from '@/types';
import { TRAVEL_PURPOSE_OPTIONS } from '@/constants/travelPurposeOptions';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface TravelPurposeSectionProps {
  entries  : TravelPurposeEntry[];
  onChange : (entries: TravelPurposeEntry[]) => void;
  disabled?: boolean;
}

// ─────────────────────────────────────────────────────────────
// EntryCard — satu blok purpose dengan checkbox grid
// ─────────────────────────────────────────────────────────────
const EntryCard: React.FC<{
  entry    : TravelPurposeEntry;
  index    : number;
  canRemove: boolean;
  disabled?: boolean;
  onChange : (id: string, field: keyof TravelPurposeEntry, value: string) => void;
  onRemove : (id: string) => void;
}> = ({ entry, index, canRemove, disabled, onChange, onRemove }) => {
  // Parse selected purposes dari field travelPurpose
  const selectedPurposes = parsePurposes(entry.travelPurpose);

  const togglePurpose = (key: string) => {
    const current = selectedPurposes;
    const updated = current.includes(key)
      ? current.filter(k => k !== key)
      : [...current, key];
    onChange(entry.id, 'travelPurpose', JSON.stringify(updated));
  };

  return (
    <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/40">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700">
          Travel Purpose #{index + 1}
        </span>
        {canRemove && !disabled && (
          <Button
            type="button" variant="ghost" size="sm"
            onClick={() => onRemove(entry.id)}
            className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
          >
            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
          </Button>
        )}
      </div>

      {/* Checkbox grid */}
      <div className="space-y-2">
        <Label>
          Travel Purpose <span className="text-red-500">*</span>
          <span className="text-xs text-gray-400 font-normal ml-2">
            (pilih satu atau lebih)
          </span>
        </Label>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2.5 p-3 border border-gray-200 rounded-lg bg-white">
          {TRAVEL_PURPOSE_OPTIONS.map(opt => (
            <label
              key={opt.key}
              className={`flex items-center gap-2 cursor-pointer select-none
                text-sm text-gray-700 hover:text-gray-900
                ${disabled ? 'opacity-60 cursor-not-allowed' : ''}
              `}
            >
              <Checkbox
                checked={selectedPurposes.includes(opt.key)}
                onCheckedChange={() => !disabled && togglePurpose(opt.key)}
                disabled={disabled}
                className="shrink-0"
              />
              <span className="leading-tight">{opt.label}</span>
            </label>
          ))}
        </div>

        {/* Badge ringkasan yang dipilih */}
        {selectedPurposes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {selectedPurposes.map(key => {
              const opt = TRAVEL_PURPOSE_OPTIONS.find(o => o.key === key);
              return (
                <span
                  key={key}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full
                    bg-green-100 text-green-800 text-xs font-medium"
                >
                  {opt?.label ?? key}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Dates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Start Date <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="date"
              value={entry.startDate}
              onChange={e => onChange(entry.id, 'startDate', e.target.value)}
              disabled={disabled}
              className="pl-10 bg-white"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>End Date <span className="text-red-500">*</span></Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="date"
              value={entry.endDate}
              onChange={e => onChange(entry.id, 'endDate', e.target.value)}
              disabled={disabled}
              className="pl-10 bg-white"
              min={entry.startDate}
            />
          </div>
        </div>
      </div>

      {/* Remarks */}
      <div className="space-y-1.5">
        <Label>Remarks / Catatan</Label>
        <Textarea
          placeholder="Tambahkan catatan tambahan jika diperlukan..."
          value={entry.purposeRemarks ?? ''}
          onChange={e => onChange(entry.id, 'purposeRemarks', e.target.value)}
          disabled={disabled}
          rows={2}
          className="resize-none bg-white"
        />
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
const TravelPurposeSection: React.FC<TravelPurposeSectionProps> = ({
  entries,
  onChange,
  disabled = false,
}) => {
  const handleChange = (id: string, field: keyof TravelPurposeEntry, value: string) =>
    onChange(entries.map(e => e.id === id ? { ...e, [field]: value } : e));

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
              <Target className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Travel Purpose</CardTitle>
              <p className="text-sm text-gray-500">Pilih tujuan perjalanan (bisa lebih dari 1)</p>
            </div>
          </div>

          {!disabled && (
            <Button
              type="button" variant="outline" size="sm"
              onClick={() => onChange([...entries, createEmptyPurposeEntry()])}
              className="text-green-700 border-green-300 hover:bg-green-50 hover:border-green-400 gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Period
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {entries.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Target className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No travel purpose added yet.</p>
            <p className="text-gray-400 text-xs mt-1">Click "Add Period" to get started.</p>
          </div>
        )}

        {entries.map((entry, idx) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            index={idx}
            canRemove={entries.length > 1}
            disabled={disabled}
            onChange={handleChange}
            onRemove={id => onChange(entries.filter(e => e.id !== id))}
          />
        ))}
      </CardContent>
    </Card>
  );
};

export default TravelPurposeSection;