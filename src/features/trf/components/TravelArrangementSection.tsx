import React, { useEffect, useRef, useState } from 'react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  AlertCircle,
  Car,
  Loader2,
  Plane,
  Plus,
  Search,
  Ship,
  Train,
  Trash2,
  User,
} from 'lucide-react';

import type {
  TransportationType,
  TravelArrangement,
  TravelType,
} from '@/types';
import { cn } from '@/lib/utils';
import {
  isSupabaseEnabled,
  supabase,
} from '@/lib/supabase';

interface TravelArrangementSectionProps {
  arrangements: TravelArrangement[];
  onChange: (
    arrangements: TravelArrangement[],
  ) => void;
  disabled?: boolean;
}

interface LocationResult {
  id?: string;
  name: string;
  type?: string;
  [key: string]: unknown;
}

interface ArrangementItemProps {
  arrangement: TravelArrangement;
  index: number;
  disabled: boolean;
  updateArrangement: (
    index: number,
    updates: Partial<TravelArrangement>,
  ) => void;
  removeArrangement: (index: number) => void;
}

const getTransportIcon = (
  type: TransportationType,
) => {
  switch (type) {
    case 'CAR':
      return Car;
    case 'FLIGHT':
      return Plane;
    case 'TRAIN':
      return Train;
    case 'SHIP':
      return Ship;
    case 'SELF_ARRANGEMENT':
      return User;
    default:
      return Plane;
  }
};

const getLocationTypeFilter = (
  transportation: TransportationType,
) => {
  switch (transportation) {
    case 'FLIGHT':
      return ['AIRPORT'];
    case 'TRAIN':
      return ['STATION', 'TRAIN_STATION'];
    case 'SHIP':
      return ['PORT', 'SEAPORT'];
    case 'CAR':
      return ['CITY', 'SITE'];
    default:
      return [
        'CITY',
        'SITE',
        'AIRPORT',
        'STATION',
        'TRAIN_STATION',
        'PORT',
        'SEAPORT',
      ];
  }
};

const ArrangementItem: React.FC<
  ArrangementItemProps
> = ({
  arrangement,
  index,
  disabled,
  updateArrangement,
  removeArrangement,
}) => {
  const isTravelIn =
    arrangement.travelType === 'TRAVEL_IN';

  const isBySiteService =
    arrangement.arrangementType ===
    'BY_SITE_SERVICE';

  const [fromQuery, setFromQuery] = useState(
    arrangement.fromLocation || '',
  );

  const [toQuery, setToQuery] = useState(
    arrangement.toLocation || '',
  );

  const [fromResults, setFromResults] =
    useState<LocationResult[]>([]);

  const [toResults, setToResults] =
    useState<LocationResult[]>([]);

  const [isSearchingFrom, setIsSearchingFrom] =
    useState(false);

  const [isSearchingTo, setIsSearchingTo] =
    useState(false);

  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setFromQuery(arrangement.fromLocation || '');
  }, [arrangement.fromLocation]);

  useEffect(() => {
    setToQuery(arrangement.toLocation || '');
  }, [arrangement.toLocation]);

  useEffect(() => {
    const handleClickOutside = (
      event: MouseEvent,
    ) => {
      const target = event.target as Node;

      if (
        fromRef.current &&
        !fromRef.current.contains(target)
      ) {
        setFromResults([]);
      }

      if (
        toRef.current &&
        !toRef.current.contains(target)
      ) {
        setToResults([]);
      }
    };

    document.addEventListener(
      'mousedown',
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handleClickOutside,
      );
    };
  }, []);

  const handleArrangementTypeChange = (
    arrangementType:
      | 'BY_SITE_SERVICE'
      | 'SELF_ARRANGEMENT',
  ) => {
    setFromQuery('');
    setToQuery('');
    setFromResults([]);
    setToResults([]);

    if (
      arrangementType === 'SELF_ARRANGEMENT'
    ) {
      updateArrangement(index, {
        arrangementType,
        transportation: 'SELF_ARRANGEMENT',
        fromLocation: '',
        toLocation: '',
        specialArrangement: false,
        justification: '',
      });

      return;
    }

    updateArrangement(index, {
      arrangementType,
      transportation:
        arrangement.transportation ===
        'SELF_ARRANGEMENT'
          ? 'FLIGHT'
          : arrangement.transportation,
      fromLocation: '',
      toLocation: '',
      specialArrangement: false,
      justification: '',
    });
  };

  const handleTransportationChange = (
    transportation: TransportationType,
  ) => {
    setFromQuery('');
    setToQuery('');
    setFromResults([]);
    setToResults([]);

    updateArrangement(index, {
      transportation,
      fromLocation: '',
      toLocation: '',
    });
  };

  const searchLocation = async (
    keyword: string,
    field: 'from' | 'to',
  ) => {
    /*
     * Self Arrangement tidak membutuhkan
     * origin dan destination.
     */
    if (!isBySiteService) return;

    if (!isSupabaseEnabled()) return;

    const normalizedKeyword = keyword.trim();

    if (normalizedKeyword.length < 2) {
      if (field === 'from') {
        setFromResults([]);
      } else {
        setToResults([]);
      }

      return;
    }

    if (field === 'from') {
      setIsSearchingFrom(true);
    } else {
      setIsSearchingTo(true);
    }

    try {
      const typeFilter =
        getLocationTypeFilter(
          arrangement.transportation,
        );

      const { data, error } = await supabase
        .from('locations')
        .select('id,name,type')
        .ilike(
          'name',
          `%${normalizedKeyword}%`,
        )
        .in('type', typeFilter)
        .limit(10);

      if (error) {
        console.error(
          'Search location error:',
          error,
        );

        if (field === 'from') {
          setFromResults([]);
        } else {
          setToResults([]);
        }

        return;
      }

      const results =
        (data as LocationResult[] | null) || [];

      if (field === 'from') {
        setFromResults(results);
      } else {
        setToResults(results);
      }
    } catch (error) {
      console.error(
        'Unexpected location search error:',
        error,
      );

      if (field === 'from') {
        setFromResults([]);
      } else {
        setToResults([]);
      }
    } finally {
      if (field === 'from') {
        setIsSearchingFrom(false);
      } else {
        setIsSearchingTo(false);
      }
    }
  };

  const TransportIcon = getTransportIcon(
    arrangement.transportation,
  );

  return (
    <div
      className={cn(
        'space-y-4 rounded-xl border p-4',
        isTravelIn
          ? 'border-blue-200 bg-blue-50/30'
          : 'border-green-200 bg-green-50/30',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-lg',
              isTravelIn
                ? 'bg-blue-100'
                : 'bg-green-100',
            )}
          >
            <TransportIcon
              className={cn(
                'h-4 w-4',
                isTravelIn
                  ? 'text-blue-600'
                  : 'text-green-600',
              )}
            />
          </div>

          <span
            className={cn(
              'font-medium',
              isTravelIn
                ? 'text-blue-700'
                : 'text-green-700',
            )}
          >
            {isTravelIn
              ? 'Travel In'
              : 'Travel Out'}{' '}
            #{index + 1}
          </span>
        </div>

        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              removeArrangement(index)
            }
            className="text-red-500 hover:bg-red-50 hover:text-red-700"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Arrangement Type */}
      <div className="space-y-2">
        <Label>Arrangement Type</Label>

        <div className="mt-2 flex flex-wrap gap-6">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`arrangement-type-${index}`}
              checked={isBySiteService}
              onChange={() =>
                handleArrangementTypeChange(
                  'BY_SITE_SERVICE',
                )
              }
              disabled={disabled}
              className="accent-blue-600"
            />

            By Site Service
          </label>

          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input
              type="radio"
              name={`arrangement-type-${index}`}
              checked={
                arrangement.arrangementType ===
                'SELF_ARRANGEMENT'
              }
              onChange={() =>
                handleArrangementTypeChange(
                  'SELF_ARRANGEMENT',
                )
              }
              disabled={disabled}
              className="accent-blue-600"
            />

            Self Arrangement
          </label>
        </div>
      </div>

      {/* Transportation — hanya By Site Service */}
      {isBySiteService && (
        <div className="space-y-2">
          <Label>Transportation</Label>

          <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
            {(
              [
                'CAR',
                'FLIGHT',
                'TRAIN',
                'SHIP',
              ] as TransportationType[]
            ).map((type) => {
              const Icon =
                getTransportIcon(type);

              return (
                <button
                  key={type}
                  type="button"
                  disabled={disabled}
                  onClick={() =>
                    handleTransportationChange(type)
                  }
                  className={cn(
                    'flex flex-col items-center gap-2 rounded-lg border p-3 transition-colors',
                    arrangement.transportation ===
                      type
                      ? 'border-blue-500 bg-white text-blue-700 shadow-sm ring-1 ring-blue-500'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300',
                  )}
                >
                  <Icon className="h-5 w-5" />

                  <span className="text-xs font-medium">
                    {type.replace('_', ' ')}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Travel Date — selalu tampil */}
      <div className="space-y-2">
        <Label>Travel Date</Label>

        <Input
          type="date"
          value={arrangement.travelDate}
          onChange={(event) =>
            updateArrangement(index, {
              travelDate:
                event.target.value,
            })
          }
          disabled={disabled}
          className="bg-white"
        />
      </div>

      {/* From dan To — hanya By Site Service */}
      {isBySiteService && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* From */}
          <div
            className="space-y-2"
            ref={fromRef}
          >
            <Label>From</Label>

            <div className="relative">
              <input
                disabled={disabled}
                value={fromQuery}
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setFromQuery(value);

                  updateArrangement(index, {
                    fromLocation: value,
                  });

                  void searchLocation(
                    value,
                    'from',
                  );
                }}
                placeholder="Search origin..."
                className="w-full rounded-md border bg-white p-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />

              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              {isSearchingFrom && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
              )}

              {fromResults.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow-lg">
                  {fromResults.map(
                    (location, resultIndex) => (
                      <button
                        key={
                          location.id ??
                          `${location.name}-${resultIndex}`
                        }
                        type="button"
                        className="flex w-full flex-col p-3 text-left hover:bg-blue-50"
                        onClick={() => {
                          setFromQuery(
                            location.name,
                          );

                          updateArrangement(
                            index,
                            {
                              fromLocation:
                                location.name,
                            },
                          );

                          setFromResults([]);
                        }}
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {location.name}
                        </span>

                        <span className="text-xs text-gray-400">
                          {location.type
                            ? location.type.replace(
                                '_',
                                ' ',
                              )
                            : ''}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>

          {/* To */}
          <div
            className="space-y-2"
            ref={toRef}
          >
            <Label>To</Label>

            <div className="relative">
              <input
                disabled={disabled}
                value={toQuery}
                onChange={(event) => {
                  const value =
                    event.target.value;

                  setToQuery(value);

                  updateArrangement(index, {
                    toLocation: value,
                  });

                  void searchLocation(value, 'to');
                }}
                placeholder="Search destination..."
                className="w-full rounded-md border bg-white p-2 pl-9 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />

              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              {isSearchingTo && (
                <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-blue-500" />
              )}

              {toResults.length > 0 && (
                <div className="absolute z-50 mt-1 max-h-48 w-full overflow-auto rounded-md border bg-white shadow-lg">
                  {toResults.map(
                    (location, resultIndex) => (
                      <button
                        key={
                          location.id ??
                          `${location.name}-${resultIndex}`
                        }
                        type="button"
                        className="flex w-full flex-col p-3 text-left hover:bg-blue-50"
                        onClick={() => {
                          setToQuery(location.name);

                          updateArrangement(
                            index,
                            {
                              toLocation:
                                location.name,
                            },
                          );

                          setToResults([]);
                        }}
                      >
                        <span className="text-sm font-medium text-gray-900">
                          {location.name}
                        </span>

                        <span className="text-xs text-gray-400">
                          {location.type
                            ? location.type.replace(
                                '_',
                                ' ',
                              )
                            : ''}
                        </span>
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Special Arrangement — hanya By Site Service */}
      {isBySiteService && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`special-${index}`}
              checked={
                arrangement.specialArrangement
              }
              onCheckedChange={(checked) =>
                updateArrangement(index, {
                  specialArrangement:
                    checked === true,
                  justification:
                    checked === true
                      ? arrangement.justification
                      : '',
                })
              }
              disabled={disabled}
            />

            <Label
              htmlFor={`special-${index}`}
              className="cursor-pointer text-sm font-normal"
            >
              Special Arrangement Required
            </Label>
          </div>

          {arrangement.specialArrangement && (
            <div className="space-y-2">
              <Label>Justification</Label>

              <Textarea
                placeholder="Explain why special arrangement is needed..."
                value={
                  arrangement.justification || ''
                }
                onChange={(event) =>
                  updateArrangement(index, {
                    justification:
                      event.target.value,
                  })
                }
                disabled={disabled}
                rows={2}
                className="resize-none bg-white"
              />
            </div>
          )}
        </div>
      )}

      {/* Notes — selalu tersedia */}
      <div className="space-y-2">
        <Label>
          {isBySiteService
            ? 'Notes'
            : 'Self Arrangement Notes'}
        </Label>

        <Textarea
          placeholder={
            isBySiteService
              ? 'Additional notes...'
              : 'Provide details or notes about the self-arranged travel...'
          }
          value={arrangement.remarks || ''}
          onChange={(event) =>
            updateArrangement(index, {
              remarks: event.target.value,
            })
          }
          disabled={disabled}
          rows={3}
          className="resize-none bg-white"
        />
      </div>
    </div>
  );
};

const TravelArrangementSection: React.FC<
  TravelArrangementSectionProps
> = ({
  arrangements,
  onChange,
  disabled = false,
}) => {
  const addArrangement = (
    travelType: TravelType,
  ) => {
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
      remarks: '',
    };

    onChange([...arrangements, newArrangement]);
  };

  const updateArrangement = (
    index: number,
    updates: Partial<TravelArrangement>,
  ) => {
    const updated = arrangements.map(
      (arrangement, arrangementIndex) =>
        arrangementIndex === index
          ? {
              ...arrangement,
              ...updates,
            }
          : arrangement,
    );

    onChange(updated);
  };

  const removeArrangement = (
    index: number,
  ) => {
    onChange(
      arrangements.filter(
        (_, arrangementIndex) =>
          arrangementIndex !== index,
      ),
    );
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
              <Plane className="h-5 w-5 text-orange-600" />
            </div>

            <div>
              <CardTitle className="text-lg">
                Travel Arrangement
              </CardTitle>

              <p className="text-sm text-gray-500">
                Transportation details
              </p>
            </div>
          </div>

          {!disabled && (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addArrangement('TRAVEL_IN')
                }
                className="border-blue-200 text-blue-600 hover:bg-blue-50"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Travel In
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  addArrangement('TRAVEL_OUT')
                }
                className="border-green-200 text-green-600 hover:bg-green-50"
              >
                <Plus className="mr-1 h-4 w-4" />
                Add Travel Out
              </Button>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />

          <div className="text-sm text-blue-800">
            <p className="font-medium">
              Travel Arrangement:
            </p>

            <ul className="mt-1 list-inside list-disc space-y-0.5">
              <li>
                You can add multiple Travel In and
                Travel Out arrangements.
              </li>

              <li>
                By Site Service requires
                transportation, origin, and
                destination.
              </li>

              <li>
                Self Arrangement does not require
                origin or destination; use Notes for
                additional information.
              </li>
            </ul>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {arrangements.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
            <Plane className="mx-auto mb-3 h-12 w-12 text-gray-300" />

            <p className="font-medium text-gray-500">
              No travel arrangements added yet
            </p>

            <p className="mt-1 text-sm text-gray-400">
              Click &quot;Add Travel In&quot; or
              &quot;Add Travel Out&quot; to add an
              arrangement.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {arrangements.map(
              (arrangement, index) => (
                <ArrangementItem
                  key={arrangement.id || index}
                  index={index}
                  arrangement={arrangement}
                  disabled={disabled}
                  updateArrangement={
                    updateArrangement
                  }
                  removeArrangement={
                    removeArrangement
                  }
                />
              ),
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default TravelArrangementSection;