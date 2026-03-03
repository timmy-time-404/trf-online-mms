import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Hotel, Calendar } from 'lucide-react';
import { useTRFStore } from '@/store';

interface AccommodationSectionProps {
  hotelName: string;
  checkInDate: string;
  checkOutDate: string;
  remarks: string;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

const AccommodationSection: React.FC<AccommodationSectionProps> = ({
  hotelName,
  checkInDate,
  checkOutDate,
  remarks,
  onChange,
  disabled = false
}) => {
  // ✅ Panggil referenceMaster
  const { referenceMaster } = useTRFStore();

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center">
            <Hotel className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Accommodation</CardTitle>
            <p className="text-sm text-gray-500">Booking details</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Hotel Selector */}
        <div className="space-y-2">
          <Label htmlFor="hotel">Select</Label>
          <Select
            value={hotelName}
            onValueChange={(value) => onChange('hotelName', value)}
            disabled={disabled}
          >
            <SelectTrigger id="hotel" className="w-full">
              <SelectValue placeholder="Select" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="placeholder" disabled>Select</SelectItem>
              {/* ✅ Gunakan data dari referenceMaster */}
              {referenceMaster.accommodations.map((hotelNameStr) => (
                <SelectItem key={hotelNameStr} value={hotelNameStr}>
                  {hotelNameStr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Check-in / Check-out Dates */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="checkInDate">Check-in Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="checkInDate"
                type="date"
                value={checkInDate}
                onChange={(e) => onChange('checkInDate', e.target.value)}
                disabled={disabled}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="checkOutDate">Check-out Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="checkOutDate"
                type="date"
                value={checkOutDate}
                onChange={(e) => onChange('checkOutDate', e.target.value)}
                disabled={disabled}
                className="pl-10"
                min={checkInDate}
              />
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div className="space-y-2">
          <Label htmlFor="accommodationRemarks">Remarks</Label>
          <Textarea
            id="accommodationRemarks"
            placeholder="Special requests or additional information..."
            value={remarks}
            onChange={(e) => onChange('remarks', e.target.value)}
            disabled={disabled}
            rows={2}
            className="resize-none"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default AccommodationSection;