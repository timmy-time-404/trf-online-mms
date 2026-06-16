import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Hotel, Calendar, Plus, Trash2 } from 'lucide-react';
import { useTRFStore } from '@/store';
import type { Accommodation } from '@/types';
 
// ─────────────────────────────────────────────────────────────
// Accommodation sudah punya interface di types/index.ts.
// Kita tambahkan field internal `_id` untuk key React.
// ─────────────────────────────────────────────────────────────
export interface AccommodationEntry extends Accommodation {
  _id: string;
}
 
const genId = () => `accom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
 
export const createEmptyAccommodationEntry = (): AccommodationEntry => ({
  _id         : genId(),
  hotelName   : '',
  checkInDate : '',
  checkOutDate: '',
  remarks     : '',
});
 
// ─────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────
interface AccommodationSectionProps {
  entries   : AccommodationEntry[];
  onChange  : (entries: AccommodationEntry[]) => void;
  disabled ?: boolean;
}
 
// ─────────────────────────────────────────────────────────────
// Single entry card
// ─────────────────────────────────────────────────────────────
interface EntryCardProps {
  entry       : AccommodationEntry;
  index       : number;
  canRemove   : boolean;
  disabled   ?: boolean;
  hotelList   : string[];
  onChange    : (id: string, field: keyof Accommodation, value: string) => void;
  onRemove    : (id: string) => void;
}
 
const EntryCard: React.FC<EntryCardProps> = ({
  entry, index, canRemove, disabled, hotelList, onChange, onRemove,
}) => (
  <div className="border border-gray-200 rounded-xl p-4 space-y-4 bg-gray-50/40">
    {/* Header */}
    <div className="flex items-center justify-between">
      <span className="text-sm font-semibold text-gray-700">
        Accommodation #{index + 1}
      </span>
      {canRemove && !disabled && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRemove(entry._id)}
          className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
        >
          <Trash2 className="w-3.5 h-3.5 mr-1" />
          Remove
        </Button>
      )}
    </div>
 
    {/* Hotel selector */}
    <div className="space-y-1.5">
      <Label>Accommodation / Hotel</Label>
      <Select
        value={entry.hotelName}
        onValueChange={val => onChange(entry._id, 'hotelName', val)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full bg-white">
          <SelectValue placeholder="Select accommodation" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="By Site Service">By Site Service</SelectItem>
          {hotelList.map(h => (
            <SelectItem key={h} value={h}>{h}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
 
    {/* Check-in / Check-out */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <Label>Check-in Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="date"
            value={entry.checkInDate}
            onChange={e => onChange(entry._id, 'checkInDate', e.target.value)}
            disabled={disabled}
            className="pl-10 bg-white"
          />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Check-out Date</Label>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            type="date"
            value={entry.checkOutDate}
            onChange={e => onChange(entry._id, 'checkOutDate', e.target.value)}
            disabled={disabled}
            className="pl-10 bg-white"
            min={entry.checkInDate}
          />
        </div>
      </div>
    </div>
 
    {/* Remarks */}
    <div className="space-y-1.5">
      <Label>Remarks</Label>
      <Textarea
        placeholder="Special requests or additional information..."
        value={entry.remarks ?? ''}
        onChange={e => onChange(entry._id, 'remarks', e.target.value)}
        disabled={disabled}
        rows={2}
        className="resize-none bg-white"
      />
    </div>
  </div>
);
 
// ─────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────
const AccommodationSection: React.FC<AccommodationSectionProps> = ({
  entries,
  onChange,
  disabled = false,
}) => {
  const { referenceMaster } = useTRFStore();
 
  const handleChange = (
    id    : string,
    field : keyof Accommodation,
    value : string,
  ) => {
    onChange(entries.map(e => e._id === id ? { ...e, [field]: value } : e));
  };
 
  const handleAdd = () => {
    onChange([...entries, createEmptyAccommodationEntry()]);
  };
 
  const handleRemove = (id: string) => {
    onChange(entries.filter(e => e._id !== id));
  };
 
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Hotel className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Accommodation</CardTitle>
              <p className="text-sm text-gray-500">Booking details</p>
            </div>
          </div>
 
          {!disabled && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              className="text-indigo-700 border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 gap-1.5"
            >
              <Plus className="w-4 h-4" />
              Add Accommodation
            </Button>
          )}
        </div>
      </CardHeader>
 
      <CardContent className="space-y-4">
        {entries.length === 0 && (
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Hotel className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">No accommodation added yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click "Add Accommodation" or leave empty if none needed.
            </p>
          </div>
        )}
 
        {entries.map((entry, idx) => (
          <EntryCard
            key={entry._id}
            entry={entry}
            index={idx}
            canRemove={true}
            disabled={disabled}
            hotelList={referenceMaster.accommodations}
            onChange={handleChange}
            onRemove={handleRemove}
          />
        ))}
      </CardContent>
    </Card>
  );
};
 
export default AccommodationSection;