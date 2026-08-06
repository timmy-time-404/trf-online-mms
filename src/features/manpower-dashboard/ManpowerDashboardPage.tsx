import React from 'react';
import {
  AlertTriangle,
  Building2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  MapPin,
  PlaneTakeoff,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  getManpowerDashboardSnapshot,
  type ManpowerDashboardSnapshot,
  type ManpowerEmployeeRow,
  type ManpowerStatus,
} from '@/lib/manpowerDashboardApi';
import {
  getLocalDateInputValue,
} from '@/lib/rosterOperationsApi';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';

const ONSITE_COLOR = '#6366F1';
const FIELD_BREAK_COLOR = '#A855F7';
const PAGE_SIZE = 20;

type StatusFilter =
  | 'ALL'
  | ManpowerStatus;

const normalizeText = (
  value?: string | null,
): string =>
  value
    ?.trim()
    .toLocaleLowerCase('id-ID') ?? '';

const formatDate = (
  value?: string | null,
): string => {
  if (!value) return '-';

  const date = new Date(
    `${value}T00:00:00`,
  );

  if (Number.isNaN(date.getTime())) {
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

const formatDateTime = (
  value?: string | null,
): string => {
  if (!value) return '-';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    },
  ).format(date);
};

const getPercentage = (
  value: number,
  total: number,
): number =>
  total > 0
    ? Math.round((value / total) * 100)
    : 0;

const getUnclassifiedReason = (
  reason: string,
): string => {
  switch (reason) {
    case 'MULTIPLE_MATCHING_INTERVALS':
      return 'Memiliki lebih dari satu interval actual yang aktif pada tanggal ini.';

    case 'NO_SITE_CYCLE':
      return 'Belum memiliki site cycle.';

    case 'ACTUAL_SITE_IN_NOT_CONFIRMED':
      return 'Actual Site In belum dikonfirmasi.';

    case 'NO_ACTUAL_INTERVAL_FOR_DATE':
      return 'Tidak ada interval actual yang mencakup tanggal ini.';

    default:
      return reason;
  }
};

const ManpowerDashboardPage:
React.FC = () => {
  const currentUser = useAuthStore(
    state => state.currentUser,
  );

  const today = React.useMemo(
    () => getLocalDateInputValue(),
    [],
  );

  const [asOfDate, setAsOfDate] =
    React.useState(today);

  const [snapshot, setSnapshot] =
    React.useState<
      ManpowerDashboardSnapshot | null
    >(null);

  const [isLoading, setIsLoading] =
    React.useState(true);

  const [errorMessage, setErrorMessage] =
    React.useState<string | null>(null);

  const [selectedDepartment, setSelectedDepartment] =
    React.useState('ALL');

  const [statusFilter, setStatusFilter] =
    React.useState<StatusFilter>('ALL');

  const [search, setSearch] =
    React.useState('');

  const [currentPage, setCurrentPage] =
    React.useState(1);

  const allowedRoles = React.useMemo(
    () => [
      'HOD',
      'HR',
      'PM',
      'SUPER_ADMIN',
    ],
    [],
  );

  const isAllowed = Boolean(
    currentUser &&
      allowedRoles.includes(
        currentUser.role,
      ),
  );

  const isHod =
    currentUser?.role === 'HOD';

  const canSeeDepartmentBreakdown =
    currentUser?.role === 'HR' ||
    currentUser?.role === 'PM' ||
    currentUser?.role ===
      'SUPER_ADMIN';

  const loadSnapshot =
    React.useCallback(
      async (
        showSuccess = false,
      ) => {
        if (!isAllowed) return;

        setIsLoading(true);
        setErrorMessage(null);

        try {
          const response =
            await getManpowerDashboardSnapshot(
              asOfDate,
            );

          setSnapshot(
            response.snapshot,
          );

          if (showSuccess) {
            toast.success(
              'Manpower Dashboard diperbarui.',
            );
          }
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Gagal mengambil Manpower Dashboard.';

          setErrorMessage(message);
          toast.error(message);
        } finally {
          setIsLoading(false);
        }
      },
      [asOfDate, isAllowed],
    );

  React.useEffect(() => {
    void loadSnapshot();
  }, [loadSnapshot]);

  React.useEffect(() => {
    if (
      selectedDepartment === 'ALL' ||
      !snapshot
    ) {
      return;
    }

    const departmentExists =
      snapshot.departments.some(
        row =>
          row.department ===
          selectedDepartment,
      );

    if (!departmentExists) {
      setSelectedDepartment('ALL');
    }
  }, [selectedDepartment, snapshot]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedDepartment,
    statusFilter,
    search,
    asOfDate,
  ]);

  const departmentScopedEmployees =
    React.useMemo(() => {
      if (!snapshot) return [];

      if (
        isHod ||
        selectedDepartment === 'ALL'
      ) {
        return snapshot.employees;
      }

      return snapshot.employees.filter(
        employee =>
          employee.department ===
          selectedDepartment,
      );
    }, [
      isHod,
      selectedDepartment,
      snapshot,
    ]);

  const scopedSummary =
    React.useMemo(() => {
      const onsite =
        departmentScopedEmployees.filter(
          employee =>
            employee.status === 'ONSITE',
        ).length;

      const fieldBreak =
        departmentScopedEmployees.filter(
          employee =>
            employee.status ===
            'FIELD_BREAK',
        ).length;

      return {
        onsite,
        fieldBreak,
        total: onsite + fieldBreak,
      };
    }, [departmentScopedEmployees]);

  const filteredEmployees =
    React.useMemo(() => {
      const keyword =
        normalizeText(search);

      return departmentScopedEmployees.filter(
        employee => {
          const statusMatches =
            statusFilter === 'ALL' ||
            employee.status ===
              statusFilter;

          if (!statusMatches) {
            return false;
          }

          if (!keyword) {
            return true;
          }

          const searchable = normalizeText(
            [
              employee.employee_code,
              employee.employee_name,
              employee.department,
              employee.job_title,
              employee.point_of_hire,
              employee.remarks,
            ]
              .filter(Boolean)
              .join(' '),
          );

          return searchable.includes(
            keyword,
          );
        },
      );
    }, [
      departmentScopedEmployees,
      search,
      statusFilter,
    ]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      filteredEmployees.length /
        PAGE_SIZE,
    ),
  );

  const paginatedEmployees =
    React.useMemo(() => {
      const safePage = Math.min(
        currentPage,
        totalPages,
      );

      const start =
        (safePage - 1) * PAGE_SIZE;

      return filteredEmployees.slice(
        start,
        start + PAGE_SIZE,
      );
    }, [
      currentPage,
      filteredEmployees,
      totalPages,
    ]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const donutData = React.useMemo(
    () => [
      {
        name: 'Onsite',
        value: scopedSummary.onsite,
        color: ONSITE_COLOR,
      },
      {
        name: 'Field Break',
        value: scopedSummary.fieldBreak,
        color: FIELD_BREAK_COLOR,
      },
    ],
    [scopedSummary],
  );

  const departmentChartHeight =
    Math.max(
      320,
      (snapshot?.departments.length ?? 0) *
        42,
    );

  const scopedUnclassified =
    React.useMemo(() => {
      if (!snapshot) return [];

      if (isHod) {
        return snapshot.data_quality
          .unclassified_employees;
      }

      if (
        selectedDepartment === 'ALL'
      ) {
        return snapshot.data_quality
          .unclassified_employees;
      }

      return snapshot.data_quality
        .unclassified_employees
        .filter(
          employee =>
            employee.department ===
            selectedDepartment,
        );
    }, [
      isHod,
      selectedDepartment,
      snapshot,
    ]);

  const selectStatus = (
    status: ManpowerStatus,
  ) => {
    setStatusFilter(
      current =>
        current === status
          ? 'ALL'
          : status,
    );
  };

  const renderEmployeeStatus = (
    employee: ManpowerEmployeeRow,
  ) => (
    <Badge
      variant="outline"
      className={cn(
        employee.status === 'ONSITE'
          ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
          : 'border-purple-200 bg-purple-50 text-purple-700',
      )}
    >
      {employee.remarks}
    </Badge>
  );

  if (!isAllowed) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6">
        <h1 className="font-semibold text-red-900">
          Access denied
        </h1>

        <p className="mt-2 text-sm text-red-700">
          Manpower Dashboard hanya
          tersedia untuk HOD, HR, PM,
          dan Super Admin.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Manpower Dashboard
          </h1>

          <p className="mt-1 text-sm text-gray-500 sm:text-base">
            {isHod
              ? `Menampilkan status manpower Department ${snapshot?.scope.department ?? currentUser?.department ?? '-'}.`
              : 'Menampilkan status manpower seluruh department berdasarkan actual movement.'}
          </p>

          {snapshot && (
            <p className="mt-1 text-xs text-gray-400">
              Last updated:{' '}
              {formatDateTime(
                snapshot.generated_at,
              )}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <label
              htmlFor="manpower-as-of-date"
              className="text-xs font-medium text-gray-600"
            >
              As of Date
            </label>

            <Input
              id="manpower-as-of-date"
              type="date"
              max={today}
              value={asOfDate}
              onChange={event =>
                setAsOfDate(
                  event.target.value,
                )
              }
              className="w-44"
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() =>
              void loadSnapshot(true)
            }
            disabled={isLoading}
          >
            <RefreshCw
              className={cn(
                'mr-2 h-4 w-4',
                isLoading &&
                  'animate-spin',
              )}
            />
            Refresh
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {scopedUnclassified.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

            <div>
              <p className="font-medium text-amber-900">
                {scopedUnclassified.length}{' '}
                employee belum dapat
                diklasifikasikan
              </p>

              <p className="mt-1 text-sm text-amber-800">
                Employee tersebut tidak
                dimasukkan ke scorecard
                Onsite maupun Field Break
                sampai actual movement
                lengkap dan unik.
              </p>

              <div className="mt-3 space-y-1 text-xs text-amber-800">
                {scopedUnclassified
                  .slice(0, 5)
                  .map(employee => (
                    <p
                      key={
                        employee.employee_id
                      }
                    >
                      {employee.employee_code}
                      {' — '}
                      {employee.employee_name}
                      {': '}
                      {getUnclassifiedReason(
                        employee.reason,
                      )}
                    </p>
                  ))}

                {scopedUnclassified.length >
                  5 && (
                  <p>
                    +
                    {scopedUnclassified.length -
                      5}{' '}
                    employee lainnya.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {isLoading && !snapshot ? (
          <>
            <Skeleton className="h-36 rounded-xl" />
            <Skeleton className="h-36 rounded-xl" />
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() =>
                selectStatus('ONSITE')
              }
              className="text-left"
            >
              <Card
                className={cn(
                  'h-full border-indigo-100 transition-shadow hover:shadow-md',
                  statusFilter ===
                    'ONSITE' &&
                    'ring-2 ring-indigo-400',
                )}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Manpower Onsite
                    </p>

                    <p className="mt-2 text-4xl font-bold text-gray-900">
                      {scopedSummary.onsite.toLocaleString(
                        'id-ID',
                      )}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {getPercentage(
                        scopedSummary.onsite,
                        scopedSummary.total,
                      )}
                      % dari classified
                      manpower
                    </p>
                  </div>

                  <div className="rounded-2xl bg-indigo-50 p-4 text-indigo-600">
                    <Users className="h-7 w-7" />
                  </div>
                </CardContent>
              </Card>
            </button>

            <button
              type="button"
              onClick={() =>
                selectStatus(
                  'FIELD_BREAK',
                )
              }
              className="text-left"
            >
              <Card
                className={cn(
                  'h-full border-purple-100 transition-shadow hover:shadow-md',
                  statusFilter ===
                    'FIELD_BREAK' &&
                    'ring-2 ring-purple-400',
                )}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      Manpower Field Break
                    </p>

                    <p className="mt-2 text-4xl font-bold text-gray-900">
                      {scopedSummary.fieldBreak.toLocaleString(
                        'id-ID',
                      )}
                    </p>

                    <p className="mt-1 text-sm text-gray-500">
                      {getPercentage(
                        scopedSummary.fieldBreak,
                        scopedSummary.total,
                      )}
                      % dari classified
                      manpower
                    </p>
                  </div>

                  <div className="rounded-2xl bg-purple-50 p-4 text-purple-600">
                    <PlaneTakeoff className="h-7 w-7" />
                  </div>
                </CardContent>
              </Card>
            </button>
          </>
        )}
      </div>

      <div
        className={cn(
          'grid gap-6',
          canSeeDepartmentBreakdown
            ? 'xl:grid-cols-[minmax(0,0.85fr)_minmax(0,1.55fr)]'
            : 'grid-cols-1',
        )}
      >
        <Card>
          <CardHeader>
            <CardTitle>
              MMS Employee Status
            </CardTitle>

            <CardDescription>
              Persentase Onsite dan Field
              Break untuk scope yang
              dipilih.
            </CardDescription>
          </CardHeader>

          <CardContent>
            {isLoading && !snapshot ? (
              <Skeleton className="h-80 rounded-lg" />
            ) : scopedSummary.total === 0 ? (
              <div className="flex h-80 items-center justify-center text-sm text-gray-500">
                Tidak ada classified
                manpower pada tanggal ini.
              </div>
            ) : (
              <>
                <div className="h-72">
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={donutData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={72}
                        outerRadius={108}
                        paddingAngle={2}
                        strokeWidth={0}
                      >
                        {donutData.map(
                          item => (
                            <Cell
                              key={item.name}
                              fill={item.color}
                            />
                          ),
                        )}
                      </Pie>

                      <Tooltip />
                      <Legend />

                      <text
                        x="50%"
                        y="45%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-500 text-xs"
                      >
                        Total
                      </text>

                      <text
                        x="50%"
                        y="54%"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        className="fill-gray-900 text-2xl font-bold"
                      >
                        {scopedSummary.total}
                      </text>
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                <div className="grid grid-cols-2 gap-3 border-t pt-4">
                  <div className="rounded-lg bg-indigo-50 p-3 text-center">
                    <p className="text-xl font-bold text-indigo-700">
                      {getPercentage(
                        scopedSummary.onsite,
                        scopedSummary.total,
                      )}
                      %
                    </p>
                    <p className="text-xs text-indigo-700">
                      Onsite
                    </p>
                  </div>

                  <div className="rounded-lg bg-purple-50 p-3 text-center">
                    <p className="text-xl font-bold text-purple-700">
                      {getPercentage(
                        scopedSummary.fieldBreak,
                        scopedSummary.total,
                      )}
                      %
                    </p>
                    <p className="text-xs text-purple-700">
                      Field Break
                    </p>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {canSeeDepartmentBreakdown && (
          <Card>
            <CardHeader>
              <CardTitle>
                MMS Employee Status by
                Department
              </CardTitle>

              <CardDescription>
                Perbandingan Onsite dan
                Field Break untuk seluruh
                department.
              </CardDescription>
            </CardHeader>

            <CardContent>
              {isLoading && !snapshot ? (
                <Skeleton className="h-80 rounded-lg" />
              ) : (
                <div className="overflow-x-auto">
                  <div
                    className="min-w-[760px]"
                    style={{
                      height:
                        departmentChartHeight,
                    }}
                  >
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <BarChart
                        data={
                          snapshot?.departments ??
                          []
                        }
                        layout="vertical"
                        margin={{
                          top: 10,
                          right: 24,
                          left: 20,
                          bottom: 10,
                        }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          horizontal={false}
                        />

                        <XAxis
                          type="number"
                          allowDecimals={false}
                        />

                        <YAxis
                          type="category"
                          dataKey="department"
                          width={210}
                          tick={{
                            fontSize: 11,
                          }}
                        />

                        <Tooltip />
                        <Legend />

                        <Bar
                          dataKey="onsite"
                          name="Onsite"
                          stackId="status"
                          fill={ONSITE_COLOR}
                        />

                        <Bar
                          dataKey="field_break"
                          name="Field Break"
                          stackId="status"
                          fill={FIELD_BREAK_COLOR}
                          radius={[0, 4, 4, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {canSeeDepartmentBreakdown && (
        <Card>
          <CardHeader>
            <CardTitle>
              Department Summary
            </CardTitle>

            <CardDescription>
              Klik department untuk
              memfilter scorecard, donut,
              dan tabel employee.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
              <div className="space-y-1.5">
                <label
                  htmlFor="manpower-department-filter"
                  className="text-xs font-medium text-gray-600"
                >
                  Department
                </label>

                <select
                  id="manpower-department-filter"
                  value={selectedDepartment}
                  onChange={event =>
                    setSelectedDepartment(
                      event.target.value,
                    )
                  }
                  className="flex h-10 min-w-72 rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <option value="ALL">
                    All Departments
                  </option>

                  {snapshot?.departments.map(
                    row => (
                      <option
                        key={row.department}
                        value={row.department}
                      >
                        {row.department}
                      </option>
                    ),
                  )}
                </select>
              </div>

              {selectedDepartment !==
                'ALL' && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    setSelectedDepartment(
                      'ALL',
                    )
                  }
                >
                  Clear department filter
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                    <th className="px-4 py-3">
                      Department
                    </th>
                    <th className="px-4 py-3 text-right">
                      Onsite
                    </th>
                    <th className="px-4 py-3 text-right">
                      Field Break
                    </th>
                    <th className="px-4 py-3 text-right">
                      Total
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {snapshot?.departments.map(
                    row => (
                      <tr
                        key={row.department}
                        onClick={() =>
                          setSelectedDepartment(
                            current =>
                              current ===
                              row.department
                                ? 'ALL'
                                : row.department,
                          )
                        }
                        className={cn(
                          'cursor-pointer border-b last:border-0 hover:bg-gray-50',
                          selectedDepartment ===
                            row.department &&
                            'bg-blue-50',
                        )}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">
                          <span className="inline-flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-gray-400" />
                            {row.department}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-indigo-700">
                          {row.onsite}
                        </td>

                        <td className="px-4 py-3 text-right font-medium text-purple-700">
                          {row.field_break}
                        </td>

                        <td className="px-4 py-3 text-right font-semibold text-gray-900">
                          {row.total}
                        </td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <div className="flex flex-col justify-between gap-4 xl:flex-row xl:items-start">
            <div>
              <CardTitle>
                Employee Status
              </CardTitle>

              <CardDescription>
                Travel Out dan Travel In
                hanya ditampilkan untuk
                employee Field Break.
              </CardDescription>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative min-w-72">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                <Input
                  value={search}
                  onChange={event =>
                    setSearch(
                      event.target.value,
                    )
                  }
                  placeholder="Cari employee, ID, department, atau POH..."
                  className="pl-9"
                />
              </div>

              <select
                value={statusFilter}
                onChange={event =>
                  setStatusFilter(
                    event.target
                      .value as StatusFilter,
                  )
                }
                className="flex h-10 min-w-44 rounded-md border border-input bg-white px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                <option value="ALL">
                  All Status
                </option>
                <option value="ONSITE">
                  Onsite
                </option>
                <option value="FIELD_BREAK">
                  Field Break
                </option>
              </select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {isLoading && !snapshot ? (
            <Skeleton className="h-96 rounded-lg" />
          ) : filteredEmployees.length ===
            0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-gray-300" />

              <p className="mt-3 font-medium text-gray-900">
                Employee tidak ditemukan
              </p>

              <p className="mt-1 text-sm text-gray-500">
                Ubah filter atau tanggal
                snapshot.
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] border-collapse text-sm">
                  <thead>
                    <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                      <th className="px-3 py-3">
                        Employee
                      </th>
                      <th className="px-3 py-3">
                        Department
                      </th>
                      <th className="px-3 py-3">
                        POH
                      </th>
                      <th className="px-3 py-3">
                        Travel Out
                      </th>
                      <th className="px-3 py-3">
                        Travel In
                      </th>
                      <th className="px-3 py-3">
                        Remarks
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedEmployees.map(
                      employee => (
                        <tr
                          key={
                            employee.employee_id
                          }
                          className="border-b align-top last:border-0 hover:bg-gray-50"
                        >
                          <td className="px-3 py-4">
                            <p className="font-medium text-gray-900">
                              {employee.employee_name}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {employee.employee_code}
                              {employee.job_title
                                ? ` · ${employee.job_title}`
                                : ''}
                            </p>
                          </td>

                          <td className="px-3 py-4 text-gray-700">
                            {employee.department ??
                              '-'}
                          </td>

                          <td className="px-3 py-4">
                            <span className="inline-flex items-center gap-1.5 text-gray-700">
                              <MapPin className="h-3.5 w-3.5 text-gray-400" />
                              {employee.point_of_hire ??
                                '-'}
                            </span>
                          </td>

                          <td className="px-3 py-4 text-gray-700">
                            {formatDate(
                              employee.travel_out,
                            )}
                          </td>

                          <td className="px-3 py-4 text-gray-700">
                            <p>
                              {formatDate(
                                employee.travel_in,
                              )}
                            </p>

                            {employee.travel_in &&
                              employee.travel_in_source && (
                                <p className="mt-1 text-xs text-gray-500">
                                  {employee.travel_in_source ===
                                  'ACTUAL'
                                    ? 'Actual return'
                                    : 'Planned return'}
                                </p>
                              )}
                          </td>

                          <td className="px-3 py-4">
                            {renderEmployeeStatus(
                              employee,
                            )}
                          </td>
                        </tr>
                      ),
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">
                <p className="text-sm text-gray-500">
                  Menampilkan{' '}
                  {paginatedEmployees.length}{' '}
                  dari{' '}
                  {filteredEmployees.length}{' '}
                  employee
                </p>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCurrentPage(
                        page =>
                          Math.max(
                            1,
                            page - 1,
                          ),
                      )
                    }
                    disabled={
                      currentPage <= 1
                    }
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>

                  <span className="min-w-24 text-center text-sm text-gray-600">
                    Page {currentPage} of{' '}
                    {totalPages}
                  </span>

                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setCurrentPage(
                        page =>
                          Math.min(
                            totalPages,
                            page + 1,
                          ),
                      )
                    }
                    disabled={
                      currentPage >=
                      totalPages
                    }
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="rounded-xl border bg-gray-50 p-4 text-xs text-gray-600">
        <div className="flex items-start gap-2">
          <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />

          <p>
            Status dihitung berdasarkan
            actual movement pada{' '}
            <strong>
              {formatDate(asOfDate)}
            </strong>
            . Employee PLANNED tanpa
            Actual Site In tidak dianggap
            Onsite.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ManpowerDashboardPage;
