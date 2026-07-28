import React from 'react';
import {
  Hotel,
  Calendar,
  Plus,
  Trash2,
} from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

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

import type { Accommodation } from '@/types';


/* ============================================================
   TYPES
   ============================================================ */

export interface AccommodationEntry extends Accommodation {
  _id: string;
}

interface AccommodationSectionProps {
  entries: AccommodationEntry[];
  onChange: (entries: AccommodationEntry[]) => void;
  disabled?: boolean;
}

interface EntryCardProps {
  entry: AccommodationEntry;
  index: number;
  canRemove: boolean;
  disabled?: boolean;

  onChange: (
    id: string,
    field: keyof Accommodation,
    value: string,
  ) => void;

  onRemove: (id: string) => void;
}


/* ============================================================
   HELPERS
   ============================================================ */

const generateAccommodationId = () =>
  `accommodation-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;


export const createEmptyAccommodationEntry =
  (): AccommodationEntry => ({
    _id: generateAccommodationId(),
    hotelName: '',
    checkInDate: '',
    checkOutDate: '',
    remarks: '',
  });


/* ============================================================
   SINGLE ACCOMMODATION CARD
   ============================================================ */

const AccommodationCard: React.FC<EntryCardProps> = ({
  entry,
  index,
  canRemove,
  disabled = false,
  onChange,
  onRemove,
}) => {
  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/40 p-4">

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
            className="h-7 px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            Remove
          </Button>
        )}

      </div>


      {/* Accommodation Arrangement */}
      <div className="space-y-1.5">

        <Label>Accommodation Arrangement</Label>

        <Select
          value={entry.hotelName}
          onValueChange={(value) =>
            onChange(
              entry._id,
              'hotelName',
              value,
            )
          }
          disabled={disabled}
        >

          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder="Select accommodation arrangement" />
          </SelectTrigger>

          <SelectContent>

            <SelectItem value="By Site Service">
              By Site Service
            </SelectItem>

            <SelectItem value="Self Arrangement">
              Self Arrangement
            </SelectItem>

          </SelectContent>

        </Select>

      </div>


      {/* Check-in / Check-out */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">

        {/* Check-in */}
        <div className="space-y-1.5">

          <Label>Check-in Date</Label>

          <div className="relative">

            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <Input
              type="date"
              value={entry.checkInDate}
              onChange={(event) =>
                onChange(
                  entry._id,
                  'checkInDate',
                  event.target.value,
                )
              }
              disabled={disabled}
              className="bg-white pl-10"
            />

          </div>

        </div>


        {/* Check-out */}
        <div className="space-y-1.5">

          <Label>Check-out Date</Label>

          <div className="relative">

            <Calendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <Input
              type="date"
              value={entry.checkOutDate}
              onChange={(event) =>
                onChange(
                  entry._id,
                  'checkOutDate',
                  event.target.value,
                )
              }
              disabled={disabled}
              min={entry.checkInDate}
              className="bg-white pl-10"
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
          onChange={(event) =>
            onChange(
              entry._id,
              'remarks',
              event.target.value,
            )
          }
          disabled={disabled}
          rows={2}
          className="resize-none bg-white"
        />

      </div>

    </div>
  );
};


/* ============================================================
   MAIN COMPONENT
   ============================================================ */

const AccommodationSection: React.FC<
  AccommodationSectionProps
> = ({
  entries,
  onChange,
  disabled = false,
}) => {

  /* ----------------------------------------------------------
     UPDATE
     ---------------------------------------------------------- */

  const handleChange = (
    id: string,
    field: keyof Accommodation,
    value: string,
  ) => {

    const updatedEntries = entries.map((entry) => {

      if (entry._id !== id) {
        return entry;
      }

      return {
        ...entry,
        [field]: value,
      };

    });

    onChange(updatedEntries);
  };


  /* ----------------------------------------------------------
     ADD
     ---------------------------------------------------------- */

  const handleAdd = () => {

    onChange([
      ...entries,
      createEmptyAccommodationEntry(),
    ]);

  };


  /* ----------------------------------------------------------
     REMOVE
     ---------------------------------------------------------- */

  const handleRemove = (id: string) => {

    const updatedEntries = entries.filter(
      (entry) => entry._id !== id,
    );

    onChange(updatedEntries);

  };


  /* ----------------------------------------------------------
     RENDER
     ---------------------------------------------------------- */

  return (

    <Card className="border shadow-sm">

      {/* Header */}
      <CardHeader className="pb-4">

        <div className="flex items-center justify-between">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-50">
              <Hotel className="h-5 w-5 text-indigo-600" />
            </div>

            <div>

              <CardTitle className="text-lg">
                Accommodation
              </CardTitle>

              <p className="text-sm text-gray-500">
                Booking details
              </p>

            </div>

          </div>


          {!disabled && (

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAdd}
              className="gap-1.5 border-indigo-300 text-indigo-700 hover:border-indigo-400 hover:bg-indigo-50"
            >

              <Plus className="h-4 w-4" />

              Add Accommodation

            </Button>

          )}

        </div>

      </CardHeader>


      {/* Content */}
      <CardContent className="space-y-4">

        {/* Empty state */}
        {entries.length === 0 && (

          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">

            <Hotel className="mx-auto mb-2 h-10 w-10 text-gray-300" />

            <p className="text-sm text-gray-500">
              No accommodation added yet.
            </p>

            <p className="mt-1 text-xs text-gray-400">
              Click "Add Accommodation" or leave empty if none needed.
            </p>

          </div>

        )}


        {/* Accommodation entries */}
        {entries.map((entry, index) => (

          <AccommodationCard
            key={entry._id}
            entry={entry}
            index={index}
            canRemove
            disabled={disabled}
            onChange={handleChange}
            onRemove={handleRemove}
          />

        ))}

      </CardContent>

    </Card>

  );
};


export default AccommodationSection;