import React from 'react';
import {
  useNavigate,
} from 'react-router-dom';

import {
  AlertCircle,
  BellRing,
  CalendarClock,
  CheckCircle2,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import {
  listEarlyRecalls,
  type EarlyRecallRecord,
  type EarlyRecallStatus,
} from '@/lib/earlyRecallApi';
import { useAuthStore } from '@/store';
import type {
  UserRole,
} from '@/types';

import EarlyRecallStatusBadge from './components/EarlyRecallStatusBadge';

const STATUS_OPTIONS: Array<{
  value: EarlyRecallStatus | 'ALL';
  label: string;
}> = [
  {
    value: 'ALL',
    label: 'All Status',
  },
  {
    value: 'DRAFT',
    label: 'Draft',
  },
  {
    value: 'PENDING_HR_VALIDATION',
    label: 'Pending HR Validation',
  },
  {
    value: 'NEEDS_REVISION',
    label: 'Needs Revision',
  },
  {
    value: 'PENDING_PM_APPROVAL',
    label: 'Pending PM Approval',
  },
  {
    value: 'PM_APPROVED',
    label: 'PM Approved',
  },
  {
    value: 'GA_PROCESSING',
    label: 'GA Processing',
  },
  {
    value: 'TRAVEL_BOOKED',
    label: 'Travel Booked',
  },
  {
    value: 'RETURNED_TO_SITE',
    label: 'Returned to Site',
  },
  {
    value: 'OS_GENERATED',
    label: 'OS Generated',
  },
  {
    value: 'REJECTED',
    label: 'Rejected',
  },
  {
    value: 'CANCELLED',
    label: 'Cancelled',
  },
];

const CREATE_ALLOWED_ROLES: UserRole[] = [
  'HOD',
  'PM',
  'SUPER_ADMIN',
];

const formatDate = (
  value?: string | null,
): string => {
  if (!value) {
    return '-';
  }

  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  const date = match
    ? new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3]),
      )
    : new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    },
  ).format(date);
};

const getVisibilityText = (
  role?: UserRole,
  department?: string,
): string => {
  switch (role) {
    case 'EMPLOYEE':
      return 'Menampilkan Early Recall milik Anda';

    case 'ADMIN_DEPT':
    case 'HOD':
      return `Menampilkan Early Recall department ${
        department ?? '-'
      }`;

    default:
      return 'Menampilkan seluruh Early Recall';
  }
};

const EarlyRecallListPage: React.FC =
  () => {
    const navigate = useNavigate();

    const currentUser = useAuthStore(
      (state) =>
        state.currentUser,
    );

    const [
      records,
      setRecords,
    ] = React.useState<
      EarlyRecallRecord[]
    >([]);

    const [
      isLoading,
      setIsLoading,
    ] = React.useState(true);

    const [
      isRefreshing,
      setIsRefreshing,
    ] = React.useState(false);

    const [
      searchQuery,
      setSearchQuery,
    ] = React.useState('');

    const [
      statusFilter,
      setStatusFilter,
    ] = React.useState<
      EarlyRecallStatus | 'ALL'
    >('ALL');

    const loadData =
      React.useCallback(
        async (
          silent = false,
        ) => {
          if (!silent) {
            setIsLoading(true);
          } else {
            setIsRefreshing(true);
          }

          try {
            const response =
              await listEarlyRecalls();

            setRecords(
              response.items,
            );
          } catch (error) {
            console.error(
              'Load Early Recall failed:',
              error,
            );

            toast.error(
              error instanceof Error
                ? error.message
                : 'Gagal mengambil daftar Early Recall.',
            );
          } finally {
            setIsLoading(false);
            setIsRefreshing(false);
          }
        },
        [],
      );

    React.useEffect(() => {
      void loadData();
    }, [loadData]);

    React.useEffect(() => {
      const handleUpdated = () => {
        void loadData(true);
      };

      window.addEventListener(
        'early-recall-updated',
        handleUpdated,
      );

      return () => {
        window.removeEventListener(
          'early-recall-updated',
          handleUpdated,
        );
      };
    }, [loadData]);

    const filteredRecords =
      React.useMemo(() => {
        const normalizedSearch =
          searchQuery
            .trim()
            .toLowerCase();

        return records.filter(
          (record) => {
            if (
              statusFilter !==
                'ALL' &&
              record.status !==
                statusFilter
            ) {
              return false;
            }

            if (
              !normalizedSearch
            ) {
              return true;
            }

            const values = [
              record.recall_number,
              record.employee
                ?.employee_name,
              record.employee
                ?.employee_code,
              record.department,
              record.reason,
              record.linked_trf
                ?.trf_number,
            ];

            return values.some(
              (value) =>
                value
                  ?.toLowerCase()
                  .includes(
                    normalizedSearch,
                  ),
            );
          },
        );
      }, [
        records,
        searchQuery,
        statusFilter,
      ]);

    const summary = React.useMemo(
      () => ({
        pendingHR: records.filter(
          (record) =>
            record.status ===
            'PENDING_HR_VALIDATION',
        ).length,

        pendingPM: records.filter(
          (record) =>
            record.status ===
            'PENDING_PM_APPROVAL',
        ).length,

        inProcess: records.filter(
          (record) =>
            [
              'PM_APPROVED',
              'GA_PROCESSING',
              'TRAVEL_BOOKED',
              'RETURNED_TO_SITE',
            ].includes(
              record.status,
            ),
        ).length,

        completed: records.filter(
          (record) =>
            record.status ===
            'OS_GENERATED',
        ).length,
      }),
      [records],
    );

    const canCreate =
      Boolean(currentUser) &&
      CREATE_ALLOWED_ROLES.includes(
        currentUser!.role,
      );

    if (isLoading) {
      return (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-500" />

            <p className="mt-3 text-sm text-gray-500">
              Memuat Early Recall...
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-5 sm:space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Early Recall
            </h1>

            <p className="mt-1 text-sm text-gray-500 sm:text-base">
              {getVisibilityText(
                currentUser?.role,
                currentUser?.department,
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={
                isRefreshing
              }
              onClick={() =>
                void loadData(true)
              }
              className="gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${
                  isRefreshing
                    ? 'animate-spin'
                    : ''
                }`}
              />
              Refresh
            </Button>

            {canCreate && (
              <Button
                type="button"
                onClick={() =>
                  navigate(
                    '/early-recall/new',
                  )
                }
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                New Early Recall
              </Button>
            )}
          </div>
        </div>

        {/* SUMMARY */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-center gap-3">
              <Users className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                  Pending HR
                </p>
                <p className="text-2xl font-bold text-blue-900">
                  {summary.pendingHR}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <div className="flex items-center gap-3">
              <BellRing className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-purple-600">
                  Pending PM
                </p>
                <p className="text-2xl font-bold text-purple-900">
                  {summary.pendingPM}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
            <div className="flex items-center gap-3">
              <CalendarClock className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-orange-600">
                  In Process
                </p>
                <p className="text-2xl font-bold text-orange-900">
                  {summary.inProcess}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-green-600">
                  OS Generated
                </p>
                <p className="text-2xl font-bold text-green-900">
                  {summary.completed}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FILTER */}
        <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

              <Input
                value={searchQuery}
                onChange={(event) =>
                  setSearchQuery(
                    event.target.value,
                  )
                }
                placeholder="Cari nomor recall, employee, department, alasan, atau linked TRF..."
                className="pl-10"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(
                value,
              ) =>
                setStatusFilter(
                  value as
                    | EarlyRecallStatus
                    | 'ALL',
                )
              }
            >
              <SelectTrigger className="w-full lg:w-64">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>

              <SelectContent className="max-h-80">
                {STATUS_OPTIONS.map(
                  (option) => (
                    <SelectItem
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </SelectItem>
                  ),
                )}
              </SelectContent>
            </Select>
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Showing{' '}
            <span className="font-semibold text-gray-700">
              {
                filteredRecords.length
              }
            </span>{' '}
            of{' '}
            <span className="font-semibold text-gray-700">
              {records.length}
            </span>{' '}
            Early Recall requests
          </p>
        </div>

        {/* EMPTY STATE */}
        {filteredRecords.length ===
          0 && (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-300" />

            <h3 className="mt-4 text-lg font-semibold text-gray-700">
              No Early Recall Found
            </h3>

            <p className="mt-1 text-sm text-gray-500">
              {records.length === 0
                ? 'Belum ada Early Recall pada scope akun Anda.'
                : 'Tidak ada data yang sesuai dengan filter.'}
            </p>

            {canCreate &&
              records.length === 0 && (
                <Button
                  type="button"
                  className="mt-4 gap-2"
                  onClick={() =>
                    navigate(
                      '/early-recall/new',
                    )
                  }
                >
                  <Plus className="h-4 w-4" />
                  Create First Request
                </Button>
              )}
          </div>
        )}

        {/* DESKTOP TABLE */}
        {filteredRecords.length >
          0 && (
          <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm md:block">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Recall
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Employee
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Leave Period
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Return
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Estimated OS
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Status
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Action
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredRecords.map(
                    (record) => (
                      <tr
                        key={record.id}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-gray-900">
                            {
                              record.recall_number
                            }
                          </p>

                          <p className="mt-1 max-w-xs truncate text-xs text-gray-500">
                            {
                              record.reason
                            }
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <p className="font-medium text-gray-900">
                            {
                              record.employee
                                .employee_name
                            }
                          </p>

                          <p className="text-xs text-gray-500">
                            {
                              record.employee
                                .employee_code
                            }{' '}
                            ·{' '}
                            {
                              record.department
                            }
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-gray-700">
                          <p>
                            {formatDate(
                              record.approved_leave_start,
                            )}
                          </p>

                          <p>
                            to{' '}
                            {formatDate(
                              record.approved_leave_end,
                            )}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top text-sm text-gray-700">
                          {formatDate(
                            record.actual_return_date ??
                              record.proposed_return_date,
                          )}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-gray-900">
                            {
                              record.os_generated_days >
                              0
                                ? record.os_generated_days
                                : record.estimated_unused_leave_days
                            }{' '}
                            days
                          </p>

                          <p className="text-xs text-gray-500">
                            {record.os_ledger
                              ? `Cycle ${record.os_ledger.cycle_number}`
                              : 'Estimated'}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <EarlyRecallStatusBadge
                            status={
                              record.status
                            }
                          />
                        </td>

                        <td className="px-4 py-4 text-right align-top">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() =>
                              navigate(
                                `/early-recall/${record.id}`,
                              )
                            }
                          >
                            <Eye className="h-4 w-4" />
                            View
                          </Button>
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* MOBILE CARDS */}
        {filteredRecords.length >
          0 && (
          <div className="space-y-3 md:hidden">
            {filteredRecords.map(
              (record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() =>
                    navigate(
                      `/early-recall/${record.id}`,
                    )
                  }
                  className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm transition hover:border-blue-200 hover:bg-blue-50/30"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-gray-900">
                        {
                          record.recall_number
                        }
                      </p>

                      <p className="mt-1 truncate text-sm font-medium text-gray-800">
                        {
                          record.employee
                            .employee_name
                        }
                      </p>

                      <p className="text-xs text-gray-500">
                        {
                          record.employee
                            .employee_code
                        }{' '}
                        ·{' '}
                        {
                          record.department
                        }
                      </p>
                    </div>

                    <EarlyRecallStatusBadge
                      status={
                        record.status
                      }
                    />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-gray-400">
                        Approved Leave
                      </p>

                      <p className="mt-1 font-medium text-gray-700">
                        {formatDate(
                          record.approved_leave_start,
                        )}
                        {' – '}
                        {formatDate(
                          record.approved_leave_end,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-gray-400">
                        Return Date
                      </p>

                      <p className="mt-1 font-medium text-gray-700">
                        {formatDate(
                          record.actual_return_date ??
                            record.proposed_return_date,
                        )}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2">
                    <p className="text-xs text-gray-500">
                      Estimated / Generated OS
                    </p>

                    <p className="font-semibold text-gray-900">
                      {record.os_generated_days >
                      0
                        ? record.os_generated_days
                        : record.estimated_unused_leave_days}{' '}
                      days
                    </p>
                  </div>
                </button>
              ),
            )}
          </div>
        )}
      </div>
    );
  };

export default EarlyRecallListPage;
