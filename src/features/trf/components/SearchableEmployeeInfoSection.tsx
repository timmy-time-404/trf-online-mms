import React from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Check,
  ChevronsUpDown,
  Mail,
  MapPin,
  Search,
  UserRound,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { Employee } from '@/types';

interface SearchableEmployeeInfoSectionProps {
  employees: Employee[];
  selectedEmployeeId: string;
  onEmployeeChange: (employeeId: string) => void;
  selectionLocked?: boolean;
}

const normalizeSearchText = (value: string): string =>
  value.trim().toLocaleLowerCase('id-ID');

const formatDate = (value?: string): string => {
  if (!value) return '-';

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const SearchableEmployeeInfoSection: React.FC<
  SearchableEmployeeInfoSectionProps
> = ({
  employees,
  selectedEmployeeId,
  onEmployeeChange,
  selectionLocked = false,
}) => {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState('');

  const selectedEmployee = React.useMemo(
    () =>
      employees.find(
        employee => employee.id === selectedEmployeeId,
      ) ?? null,
    [employees, selectedEmployeeId],
  );

  const filteredEmployees = React.useMemo(() => {
    const keyword = normalizeSearchText(search);

    const source = keyword
      ? employees.filter(employee => {
          const searchableText = normalizeSearchText(
            [
              employee.employeeCode,
              employee.employeeName,
              employee.department,
              employee.jobTitle,
              employee.section,
            ]
              .filter(Boolean)
              .join(' '),
          );

          return searchableText.includes(keyword);
        })
      : employees;

    return source
      .slice()
      .sort((first, second) =>
        first.employeeName.localeCompare(
          second.employeeName,
          'id-ID',
        ),
      )
      .slice(0, 30);
  }, [employees, search]);

  const handleSelect = (employee: Employee) => {
    onEmployeeChange(employee.id);
    setSearch('');
    setOpen(false);
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Employee Information
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Pilih employee berdasarkan ID, nama, department, atau
            jabatan.
          </p>
        </div>

        <div className="rounded-full bg-blue-50 p-2 text-blue-600">
          <UserRound className="h-5 w-5" />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="trf-employee-search"
          className="text-sm font-medium text-gray-700"
        >
          Employee
        </label>

        <Popover
          open={open}
          onOpenChange={nextOpen => {
            if (!selectionLocked) {
              setOpen(nextOpen);

              if (!nextOpen) {
                setSearch('');
              }
            }
          }}
        >
          <PopoverTrigger asChild>
            <Button
              id="trf-employee-search"
              type="button"
              variant="outline"
              role="combobox"
              aria-expanded={open}
              disabled={selectionLocked}
              className={cn(
                'h-auto min-h-11 w-full justify-between px-3 py-2 text-left font-normal',
                !selectedEmployee && 'text-muted-foreground',
              )}
            >
              <span className="min-w-0">
                {selectedEmployee ? (
                  <span className="block">
                    <span className="block truncate font-medium text-gray-900">
                      {selectedEmployee.employeeCode}
                      {' — '}
                      {selectedEmployee.employeeName}
                    </span>

                    <span className="mt-0.5 block truncate text-xs text-gray-500">
                      {selectedEmployee.department}
                      {' · '}
                      {selectedEmployee.jobTitle}
                    </span>
                  </span>
                ) : (
                  'Cari dan pilih employee'
                )}
              </span>

              <ChevronsUpDown className="ml-3 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>

          <PopoverContent
            align="start"
            className="w-[var(--radix-popover-trigger-width)] p-0"
          >
            <Command shouldFilter={false}>
              <CommandInput
                value={search}
                onValueChange={setSearch}
                placeholder="Cari Employee ID, nama, department, atau jabatan..."
              />

              <CommandList className="max-h-80">
                <CommandEmpty>
                  Employee tidak ditemukan.
                </CommandEmpty>

                <CommandGroup
                  heading={`${filteredEmployees.length} hasil ditampilkan`}
                >
                  {filteredEmployees.map(employee => {
                    const selected =
                      employee.id === selectedEmployeeId;

                    return (
                      <CommandItem
                        key={employee.id}
                        value={[
                          employee.employeeCode,
                          employee.employeeName,
                          employee.department,
                          employee.jobTitle,
                        ].join(' ')}
                        onSelect={() => handleSelect(employee)}
                        className="items-start py-3"
                      >
                        <Check
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0',
                            selected
                              ? 'opacity-100'
                              : 'opacity-0',
                          )}
                        />

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-900">
                            {employee.employeeCode}
                            {' — '}
                            {employee.employeeName}
                          </p>

                          <p className="mt-1 truncate text-xs text-gray-500">
                            {employee.department}
                            {' · '}
                            {employee.jobTitle}
                          </p>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        {selectionLocked && (
          <p className="text-xs text-gray-500">
            Employee mengikuti akun yang sedang login.
          </p>
        )}

        {!selectionLocked && (
          <p className="text-xs text-gray-500">
            Maksimal 30 hasil ditampilkan. Ketik Employee ID atau nama
            untuk mempersempit pencarian.
          </p>
        )}
      </div>

      {selectedEmployee ? (
        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
          <div className="flex flex-col justify-between gap-4 border-b border-gray-200 pb-4 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="truncate text-lg font-semibold text-gray-900">
                {selectedEmployee.employeeName}
              </p>

              <p className="mt-1 text-sm text-gray-500">
                {selectedEmployee.employeeCode}
                {' · '}
                {selectedEmployee.jobTitle}
              </p>
            </div>

            <Badge
              variant="secondary"
              className="self-start bg-blue-100 text-blue-700"
            >
              {selectedEmployee.employeeType || 'EMPLOYEE'}
            </Badge>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  Department
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {selectedEmployee.department || '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <BriefcaseBusiness className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  Job Title
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {selectedEmployee.jobTitle || '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  Section
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {selectedEmployee.section || '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  Email
                </p>
                <p className="mt-1 break-all text-sm font-medium text-gray-900">
                  {selectedEmployee.email || '-'}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  Date of Hire
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {formatDate(selectedEmployee.dateOfHire)}
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <Search className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <div className="min-w-0">
                <p className="text-xs text-gray-500">
                  Point of Hire
                </p>
                <p className="mt-1 text-sm font-medium text-gray-900">
                  {selectedEmployee.pointOfHire || '-'}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-gray-300 p-8 text-center">
          <UserRound className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            Belum ada employee yang dipilih
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Gunakan kolom pencarian di atas.
          </p>
        </div>
      )}
    </section>
  );
};

export default SearchableEmployeeInfoSection;
