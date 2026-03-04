import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Plane, Car, Train, User, Plus, Trash2, AlertCircle, Ship, Search, Loader2 } from 'lucide-react';
import type { TravelArrangement, TravelType, TransportationType } from '@/types';
import { cn } from '@/lib/utils';
import { supabase, isSupabaseEnabled } from '@/lib/supabase'; 

interface TravelArrangementSectionProps {
  arrangements: TravelArrangement[];
  onChange: (arrangements: TravelArrangement[]) => void;
  disabled?: boolean;
};
interface LocationResult {
  id?: string;
  name: string;
  type?: string;
  [key: string]: unknown; // Jaring pengaman untuk properti tak terduga
}

// ============================================================================
// INDIVIDUAL ARRANGEMENT ITEM COMPONENT
// ============================================================================
const ArrangementItem = ({ 
  arrangement, 
  index, 
  disabled, 
  updateArrangement, 
  removeArrangement 
}: {
  arrangement: TravelArrangement,
  index: number,
  disabled: boolean,
  // ✅ FIX: Ganti fungsi ini untuk menerima Object (banyak update sekaligus)
  updateArrangement: (idx: number, updates: Partial<TravelArrangement>) => void,
  removeArrangement: (idx: number) => void
}) => {

  const isTravelIn = arrangement.travelType === 'TRAVEL_IN';
  
  const [fromQuery, setFromQuery] = useState(arrangement.fromLocation || "");
  const [toQuery, setToQuery] = useState(arrangement.toLocation || "");
  const [fromResults, setFromResults] = useState<LocationResult[]>([]);
  const [toResults, setToResults] = useState<LocationResult[]>([]);
  const [isSearchingFrom, setIsSearchingFrom] = useState(false);
  const [isSearchingTo, setIsSearchingTo] = useState(false);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (fromRef.current && !fromRef.current.contains(event.target as Node)) {
        setFromResults([]);
      }
      if (toRef.current && !toRef.current.contains(event.target as Node)) {
        setToResults([]);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (arrangement.arrangementType === "SELF_ARRANGEMENT" && arrangement.transportation !== "SELF_ARRANGEMENT") {
       updateArrangement(index, { transportation: 'SELF_ARRANGEMENT' });
    } else if (arrangement.arrangementType === "BY_SITE_SERVICE" && arrangement.transportation === "SELF_ARRANGEMENT") {
       updateArrangement(index, { transportation: 'FLIGHT' }); 
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arrangement.arrangementType, index]);

  const searchLocation = async (keyword: string, field: 'from' | 'to') => {
    if (!isSupabaseEnabled()) return;
    
    if (keyword.length < 2) {
      if (field === 'from') setFromResults([]);
      else setToResults([]);
      return;
    }

    if (field === 'from') setIsSearchingFrom(true);
    else setIsSearchingTo(true);

    let typeFilter = ["CITY", "SITE", "AIRPORT", "STATION", "PORT", "TRAIN_STATION", "SEAPORT"]; 

    if (arrangement.arrangementType === "BY_SITE_SERVICE") {
      if (arrangement.transportation === "FLIGHT") typeFilter = ["AIRPORT"];
      if (arrangement.transportation === "TRAIN") typeFilter = ["STATION", "TRAIN_STATION"];
      if (arrangement.transportation === "SHIP") typeFilter = ["PORT", "SEAPORT"];
      if (arrangement.transportation === "CAR") typeFilter = ["CITY", "SITE"];
    }

    const { data } = await supabase
      .from("locations")
      .select("name,type")
      .ilike("name", `%${keyword}%`)
      .in("type", typeFilter)
      .limit(10);

    if (field === 'from') {
      setFromResults(data || []);
      setIsSearchingFrom(false);
    } else {
      setToResults(data || []);
      setIsSearchingTo(false);
    }
  };

  const getTransportIcon = (type: TransportationType) => {
    switch (type) {
      case 'CAR': return Car;
      case 'FLIGHT': return Plane;
      case 'TRAIN': return Train;
      case 'SHIP': return Ship;
      case 'SELF_ARRANGEMENT': return User;
      default: return Plane;
    }
  };

  const TransportIcon = getTransportIcon(arrangement.transportation);

  return (
    <div className={cn(
      'border rounded-xl p-4 space-y-4',
      isTravelIn ? 'border-blue-200 bg-blue-50/30' : 'border-green-200 bg-green-50/30'
    )}>
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
        <div className="flex gap-6 mt-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name={`arrType-${index}`}
              checked={arrangement.arrangementType === "BY_SITE_SERVICE"}
              onChange={() => updateArrangement(index, { arrangementType: 'BY_SITE_SERVICE' })}
              disabled={disabled}
              className="accent-blue-600"
            />
            By Site Service
          </label>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="radio"
              name={`arrType-${index}`}
              checked={arrangement.arrangementType === "SELF_ARRANGEMENT"}
              onChange={() => updateArrangement(index, { arrangementType: 'SELF_ARRANGEMENT' })}
              disabled={disabled}
              className="accent-blue-600"
            />
            Self Arrangement
          </label>
        </div>
      </div>

      {/* Transportation */}
      {arrangement.arrangementType === "BY_SITE_SERVICE" && (
        <div className="space-y-2">
          <Label>Transportation</Label>
          <div className="grid grid-cols-4 gap-3 mt-2">
            {(['CAR', 'FLIGHT', 'TRAIN', 'SHIP'] as TransportationType[]).map((type) => {
              const Icon = getTransportIcon(type);
              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    // ✅ FIX: GABUNGKAN 3 UPDATE MENJADI 1 OBJECT AGAR TIDAK TERTUMPUK
                    updateArrangement(index, { 
                      transportation: type, 
                      fromLocation: '', 
                      toLocation: '' 
                    });
                    setFromQuery('');
                    setToQuery('');
                  }}
                  className={cn(
                    'flex flex-col items-center gap-2 p-3 rounded-lg border transition-colors',
                    arrangement.transportation === type
                      ? 'border-blue-500 bg-white text-blue-700 shadow-sm ring-1 ring-blue-500'
                      : 'border-gray-200 bg-white hover:border-gray-300 text-gray-600'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium capitalize">{type.replace('_', ' ')}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Travel Date */}
      <div className="space-y-2">
        <Label>Travel Date</Label>
        <Input
          type="date"
          value={arrangement.travelDate}
          onChange={(e) => updateArrangement(index, { travelDate: e.target.value })}
          disabled={disabled}
          className="bg-white"
        />
      </div>

      {/* From / To */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* FROM LOCATION */}
        <div className="space-y-2" ref={fromRef}>
          <Label>From</Label>
          <div className="relative">
            <input
              disabled={disabled}
              value={fromQuery}
              onChange={(e) => {
                setFromQuery(e.target.value);
                updateArrangement(index, { fromLocation: e.target.value });
                searchLocation(e.target.value, 'from');
              }}
              placeholder="Search origin..."
              className="w-full border rounded-md p-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {isSearchingFrom && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
            
            {fromResults.length > 0 && (
              <div className="absolute bg-white border rounded-md w-full shadow-lg z-50 mt-1 max-h-48 overflow-auto">
                {fromResults.map((loc, i) => (
                  <div
                    key={i}
                    className="p-3 hover:bg-blue-50 cursor-pointer flex flex-col"
                    onClick={() => {
                      setFromQuery(loc.name);
                      updateArrangement(index, { fromLocation: loc.name });
                      setFromResults([]);
                    }}
                  >
                    <span className="text-sm font-medium text-gray-900">{loc.name}</span>
                    <span className="text-xs text-gray-400">
  {loc.type ? loc.type.replace('_', ' ') : ''}
</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TO LOCATION */}
        <div className="space-y-2" ref={toRef}>
          <Label>To</Label>
          <div className="relative">
            <input
              disabled={disabled}
              value={toQuery}
              onChange={(e) => {
                setToQuery(e.target.value);
                updateArrangement(index, { toLocation: e.target.value });
                searchLocation(e.target.value, 'to');
              }}
              placeholder="Search destination..."
              className="w-full border rounded-md p-2 pl-9 text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            {isSearchingTo && <Loader2 className="w-4 h-4 text-blue-500 animate-spin absolute right-3 top-1/2 -translate-y-1/2" />}
            
            {toResults.length > 0 && (
              <div className="absolute bg-white border rounded-md w-full shadow-lg z-50 mt-1 max-h-48 overflow-auto">
                {toResults.map((loc, i) => (
                  <div
                    key={i}
                    className="p-3 hover:bg-blue-50 cursor-pointer flex flex-col"
                    onClick={() => {
                      setToQuery(loc.name);
                      updateArrangement(index, { toLocation: loc.name });
                      setToResults([]);
                    }}
                  >
                    <span className="text-sm font-medium text-gray-900">{loc.name}</span>
                    <span className="text-xs text-gray-400">
  {loc.type ? loc.type.replace('_', ' ') : ''}
</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Special Arrangement */}
      <div className="space-y-3 pt-2">
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
              className="resize-none bg-white"
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
          className="resize-none bg-white"
        />
      </div>
    </div>
  );
};


// ============================================================================
// MAIN COMPONENT
// ============================================================================
const TravelArrangementSection: React.FC<TravelArrangementSectionProps> = ({
  arrangements,
  onChange,
  disabled = false
}) => {

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

  // ✅ FIX: Fungsi utama sekarang bisa memproses Object yang berisi >1 perubahan
  const updateArrangement = (index: number, updates: Partial<TravelArrangement>) => {
    const updated = arrangements.map((arr, i) =>
      i === index ? { ...arr, ...updates } : arr
    );
    onChange(updated);
  };

  const removeArrangement = (index: number) => {
    onChange(arrangements.filter((_, i) => i !== index));
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
          <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
            <Plane className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No travel arrangements added yet</p>
            <p className="text-sm text-gray-400 mt-1">
              Click "Add Travel In" or "Add Travel Out" to add arrangements
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {arrangements.map((arrangement, index) => (
              <ArrangementItem
                key={arrangement.id || index}
                index={index}
                arrangement={arrangement}
                disabled={disabled}
                updateArrangement={updateArrangement}
                removeArrangement={removeArrangement}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TravelArrangementSection;