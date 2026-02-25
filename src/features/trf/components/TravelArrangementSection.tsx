import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Plane, Car, Train, User, Plus, Trash2, AlertCircle } from 'lucide-react';
import { useTRFStore } from '@/store';
import type { TravelArrangement, TravelType, TransportationType, ArrangementType } from '@/types';
import { cn } from '@/lib/utils';

interface TravelArrangementSectionProps {
  arrangements: TravelArrangement[];
  onChange: (arrangements: TravelArrangement[]) => void;
  disabled?: boolean;
}

const TravelArrangementSection: React.FC<TravelArrangementSectionProps> = ({
  arrangements,
  onChange,
  disabled = false
}) => {
  const { referenceData } = useTRFStore();

  // ✅ HAPUS: Logic pembatasan untuk unlimited
  // const travelInCount = arrangements.filter(a => a.travelType === 'TRAVEL_IN').length;
  // const travelOutCount = arrangements.filter(a => a.travelType === 'TRAVEL_OUT').length;
  // const canAddTravelIn = travelInCount < 1;
  // const canAddTravelOut = travelOutCount < 1;

  const addArrangement = (travelType: TravelType) => {
    const newArrangement: TravelArrangement = {
      id: `ta-${Date.now()}`,
      travelType,
      arrangementType: 'BY_SITE_SERVICE',
      transportation: 'FLIGHT',
      travelDate: '',
      fromLocation: '',
      toLocation: '',
      specialArrangement: false,
      justification: '',
      remarks: ''
    };
    onChange([...arrangements, newArrangement]);
  };

  const updateArrangement = (index: number, updates: Partial<TravelArrangement>) => {
    const updated = arrangements.map((arr, i) =>
      i === index ? { ...arr, ...updates } : arr
    );
    onChange(updated);
  };

  const removeArrangement = (index: number) => {
    onChange(arrangements.filter((_, i) => i !== index));
  };

  const getTransportIcon = (type: TransportationType) => {
    switch (type) {
      case 'CAR': return Car;
      case 'FLIGHT': return Plane;
      case 'TRAIN': return Train;
      case 'SELF_ARRANGEMENT': return User;
      default: return Plane;
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
              <Plane className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <CardTitle className="text-lg">Travel Arrangement</CardTitle>
              <p className="text-sm text-gray-500">Transportation details</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* ✅ HAPUS: Kondisi canAddTravelIn */}
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrangement('TRAVEL_IN')}
                className="text-blue-600 border-blue-200 hover:bg-blue-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Travel In
              </Button>
            )}
            {/* ✅ HAPUS: Kondisi canAddTravelOut */}
            {!disabled && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addArrangement('TRAVEL_OUT')}
                className="text-green-600 border-green-200 hover:bg-green-50"
              >
                <Plus className="w-4 h-4 mr-1" />
                Add Travel Out
              </Button>
            )}
          </div>
        </div>

        {/* ✅ UPDATE: Info text untuk unlimited */}
        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800">
            <p className="font-medium">Travel Arrangement:</p>
            <ul className="mt-1 space-y-0.5 list-disc list-inside">
              <li>You can add multiple Travel In and Travel Out arrangements</li>
              <li>Each arrangement can use different transportation modes</li>
            </ul>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {arrangements.length === 0 ? (
          <div className="text-center py-8 bg-gray-50 rounded-xl">
            <Plane className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No travel arrangements added yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Click "Add Travel In" or "Add Travel Out" to add arrangements
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {arrangements.map((arrangement, index) => {
              const TransportIcon = getTransportIcon(arrangement.transportation);
              const isTravelIn = arrangement.travelType === 'TRAVEL_IN';

              return (
                <div
                  key={arrangement.id || index}
                  className={cn(
                    'border rounded-xl p-4 space-y-4',
                    isTravelIn ? 'border-blue-200 bg-blue-50/30' : 'border-green-200 bg-green-50/30'
                  )}
                >
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        'w-8 h-8 rounded-lg flex items-center justify-center',
                        isTravelIn ? 'bg-blue-100' : 'bg-green-100'
                      )}>
                        <TransportIcon className={cn(
                          'w-4 h-4',
                          isTravelIn ? 'text-blue-600' : 'text-green-600'
                        )} />
                      </div>
                      {/* ✅ TAMBAH: Nomor urut untuk membedakan multiple arrangements */}
                      <span className={cn(
                        'font-medium',
                        isTravelIn ? 'text-blue-700' : 'text-green-700'
                      )}>
                        {isTravelIn ? 'Travel In' : 'Travel Out'} #{index + 1}
                      </span>
                    </div>
                    {!disabled && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeArrangement(index)}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Arrangement Type */}
                  <div className="space-y-2">
                    <Label>Arrangement Type</Label>
                    <RadioGroup
                      value={arrangement.arrangementType}
                      onValueChange={(value) =>
                        updateArrangement(index, { arrangementType: value as ArrangementType })
                      }
                      disabled={disabled}
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="BY_SITE_SERVICE" id={`site-${index}`} />
                        <Label htmlFor={`site-${index}`} className="text-sm font-normal cursor-pointer">
                          By Site Service
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="SELF_ARRANGEMENT" id={`self-${index}`} />
                        <Label htmlFor={`self-${index}`} className="text-sm font-normal cursor-pointer">
                          Self Arrangement
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* Transportation */}
                  <div className="space-y-2">
                    <Label>Transportation</Label>
                    <div className="grid grid-cols-4 gap-2">
                      {(['CAR', 'FLIGHT', 'TRAIN', 'SELF_ARRANGEMENT'] as TransportationType[]).map((type) => {
                        const Icon = getTransportIcon(type);
                        return (
                          <button
                            key={type}
                            type="button"
                            disabled={disabled}
                            onClick={() => updateArrangement(index, { transportation: type })}
                            className={cn(
                              'flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors',
                              arrangement.transportation === type
                                ? 'border-blue-500 bg-blue-50 text-blue-700'
                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                            )}
                          >
                            <Icon className="w-5 h-5" />
                            <span className="text-xs capitalize">{type.replace('_', ' ')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Travel Date */}
                  <div className="space-y-2">
                    <Label>Travel Date</Label>
                    <Input
                      type="date"
                      value={arrangement.travelDate}
                      onChange={(e) => updateArrangement(index, { travelDate: e.target.value })}
                      disabled={disabled}
                    />
                  </div>

                  {/* From / To */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>From</Label>
                      <Select
                        value={arrangement.fromLocation || 'placeholder'}
                        onValueChange={(value) => {
                          if (value !== 'placeholder') {
                            updateArrangement(index, { fromLocation: value });
                          }
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select origin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="placeholder" disabled>Select origin</SelectItem>
                          {referenceData.locations.map((loc) => (
                            <SelectItem key={loc.code} value={loc.name}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>To</Label>
                      <Select
                        value={arrangement.toLocation || 'placeholder'}
                        onValueChange={(value) => {
                          if (value !== 'placeholder') {
                            updateArrangement(index, { toLocation: value });
                          }
                        }}
                        disabled={disabled}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select destination" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="placeholder" disabled>Select destination</SelectItem>
                          {referenceData.locations.map((loc) => (
                            <SelectItem key={loc.code} value={loc.name}>
                              {loc.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Special Arrangement */}
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`special-${index}`}
                        checked={arrangement.specialArrangement}
                        onCheckedChange={(checked) =>
                          updateArrangement(index, { specialArrangement: checked as boolean })
                        }
                        disabled={disabled}
                      />
                      <Label htmlFor={`special-${index}`} className="text-sm font-normal cursor-pointer">
                        Special Arrangement Required
                      </Label>
                    </div>

                    {arrangement.specialArrangement && (
                      <div className="space-y-2">
                        <Label>Justification</Label>
                        <Textarea
                          placeholder="Explain why special arrangement is needed..."
                          value={arrangement.justification}
                          onChange={(e) => updateArrangement(index, { justification: e.target.value })}
                          disabled={disabled}
                          rows={2}
                          className="resize-none"
                        />
                      </div>
                    )}
                  </div>

                  {/* Remarks */}
                  <div className="space-y-2">
                    <Label>Remarks</Label>
                    <Textarea
                      placeholder="Additional notes..."
                      value={arrangement.remarks}
                      onChange={(e) => updateArrangement(index, { remarks: e.target.value })}
                      disabled={disabled}
                      rows={2}
                      className="resize-none"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TravelArrangementSection;