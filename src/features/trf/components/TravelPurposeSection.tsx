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
import { Target, Calendar } from 'lucide-react';
import { useTRFStore } from '@/store';

interface TravelPurposeSectionProps {
  purpose: string;
  startDate: string;
  endDate: string;
  remarks: string;
  onChange: (field: string, value: string) => void;
  disabled?: boolean;
}

const TravelPurposeSection: React.FC<TravelPurposeSectionProps> = ({
  purpose,
  startDate,
  endDate,
  remarks,
  onChange,
  disabled = false
}) => {
  const { referenceData } = useTRFStore();

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
            <Target className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Travel Purpose</CardTitle>
            <p className="text-sm text-gray-500">Define the purpose and duration</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Purpose */}
        <div className="space-y-2">
          <Label htmlFor="purpose">
            Travel Purpose <span className="text-red-500">*</span>
          </Label>
          <Select
            value={purpose}
            onValueChange={(value) => onChange('travelPurpose', value)}
            disabled={disabled}
          >
            <SelectTrigger id="purpose" className="w-full">
              <SelectValue placeholder="Select travel purpose" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" disabled>Select travel purpose</SelectItem>
              {referenceData.purposes.map((p) => (
                <SelectItem key={p.code} value={p.name}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Date Range */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="startDate">
              Start Date <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => onChange('startDate', e.target.value)}
                disabled={disabled}
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="endDate">
              End Date <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => onChange('endDate', e.target.value)}
                disabled={disabled}
                className="pl-10"
                min={startDate}
              />
            </div>
          </div>
        </div>

        {/* Remarks */}
        <div className="space-y-2">
          <Label htmlFor="purposeRemarks">Remarks</Label>
          <Textarea
            id="purposeRemarks"
            placeholder="Add any additional information about the travel purpose..."
            value={remarks}
            onChange={(e) => onChange('purposeRemarks', e.target.value)}
            disabled={disabled}
            rows={3}
            className="resize-none"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default TravelPurposeSection;
