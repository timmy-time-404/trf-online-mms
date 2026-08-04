import React from 'react';
import {
  CalendarDays,
  Clock3,
  History,
  RefreshCw,
  ShieldCheck,
  TimerReset,
  WalletCards,
} from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  getLocalDateInputValue,
  getMyRosterSummary,
  type MyRosterCycleHistoryItem,
  type MyRosterOSBucket,
  type MyRosterSummary,
} from '@/lib/rosterOperationsApi';
import { cn } from '@/lib/utils';

const formatDate = (
  value?: string | null,
): string => {
  if (!value) return '-';

  const date = new Date(`${value}T00:00:00`);

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

const getErrorMessage = (
  error: unknown,
): string =>
  error instanceof Error
    ? error.message
    : 'Data My Roster & OS gagal dimuat.';

const getStatusLabel = (
  status?: string | null,
): string => {
  const labels: Record<string, string> = {
    PLANNED: 'Planned',
    ON_SITE: 'On Site',
    TRAVEL_OUT_PENDING:
      'Travel Out / Leave Start Pending',
    ON_LEAVE: 'On Leave',
    COMPLETED: 'Completed',
    CANCELLED: 'Cancelled',

    AVAILABLE: 'Available',
    PARTIALLY_USED: 'Partially Used',
    USED: 'Used',
    EXPIRED: 'Expired',
  };

  if (!status) return '-';

  return labels[status] ?? status;
};

const getStatusClass = (
  status?: string | null,
): string => {
  switch (status) {
    case 'ON_SITE':
    case 'AVAILABLE':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';

    case 'ON_LEAVE':
      return 'border-blue-200 bg-blue-50 text-blue-700';

    case 'TRAVEL_OUT_PENDING':
    case 'PARTIALLY_USED':
      return 'border-amber-200 bg-amber-50 text-amber-700';

    case 'COMPLETED':
    case 'USED':
      return 'border-gray-200 bg-gray-50 text-gray-700';

    case 'EXPIRED':
    case 'CANCELLED':
      return 'border-red-200 bg-red-50 text-red-700';

    default:
      return 'border-gray-200 bg-white text-gray-700';
  }
};

const getSourceLabel = (
  sourceType: string,
): string => {
  const labels: Record<string, string> = {
    OVERSTAY: 'Overstay',
    EARLY_RECALL: 'Early Recall',
    MANUAL_ADJUSTMENT: 'Manual Adjustment',
  };

  return labels[sourceType] ?? sourceType;
};

const EmptyState: React.FC<{
  title: string;
  description: string;
}> = ({
  title,
  description,
}) => (
  <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-5 py-10 text-center">
    <p className="font-medium text-gray-900">
      {title}
    </p>

    <p className="mt-1 text-sm text-gray-500">
      {description}
    </p>
  </div>
);

const LoadingState: React.FC = () => (
  <div className="space-y-5">
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map(
        (_, index) => (
          <div
            key={index}
            className="h-32 animate-pulse rounded-xl border bg-gray-100"
          />
        ),
      )}
    </div>

    <div className="h-72 animate-pulse rounded-xl border bg-gray-100" />
  </div>
);

const OSBucketRow: React.FC<{
  bucket: MyRosterOSBucket;
}> = ({ bucket }) => (
  <tr className="border-b last:border-b-0">
    <td className="px-4 py-3 align-top">
      <p className="font-medium text-gray-900">
        {bucket.os_number}
      </p>

      <p className="mt-1 text-xs text-gray-500">
        {getSourceLabel(bucket.source_type)}
      </p>
    </td>

    <td className="px-4 py-3 align-top text-sm text-gray-700">
      {formatDate(bucket.generated_date)}
    </td>

    <td className="px-4 py-3 align-top text-sm text-gray-700">
      Cycle {bucket.cycle_number}
    </td>

    <td className="px-4 py-3 align-top">
      <span className="text-lg font-semibold text-gray-950">
        {bucket.remaining_days}
      </span>

      <span className="ml-1 text-sm text-gray-500">
        hari
      </span>
    </td>

    <td className="px-4 py-3 align-top">
      <Badge
        variant="outline"
        className={cn(
          'font-normal',
          getStatusClass(bucket.status),
        )}
      >
        {getStatusLabel(bucket.status)}
      </Badge>
    </td>
  </tr>
);

const CycleHistoryCard: React.FC<{
  item: MyRosterCycleHistoryItem;
}> = ({ item }) => (
  <div className="rounded-xl border bg-white p-4">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="font-semibold text-gray-950">
        Cycle {item.cycle_number}
      </p>

      <Badge
        variant="outline"
        className={cn(
          'font-normal',
          getStatusClass(item.status),
        )}
      >
        {getStatusLabel(item.status)}
      </Badge>
    </div>

    <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">
          Site
        </p>

        <p className="mt-1 text-gray-700">
          {formatDate(
            item.actual_site_in ??
              item.planned_site_in,
          )}
          {' — '}
          {formatDate(
            item.actual_site_out ??
              item.planned_site_out,
          )}
        </p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-gray-400">
          Leave
        </p>

        <p className="mt-1 text-gray-700">
          {formatDate(
            item.actual_leave_start ??
              item.planned_leave_start,
          )}
          {' — '}
          {formatDate(
            item.actual_leave_end ??
              item.planned_leave_end,
          )}
        </p>
      </div>
    </div>
  </div>
);

const MyRosterOSPage: React.FC = () => {
  const [
    summary,
    setSummary,
  ] = React.useState<MyRosterSummary | null>(
    null,
  );

  const [
    loading,
    setLoading,
  ] = React.useState(true);

  const [
    error,
    setError,
  ] = React.useState<string | null>(
    null,
  );

  const loadSummary =
    React.useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const response =
          await getMyRosterSummary(
            getLocalDateInputValue(),
          );

        setSummary(response.summary);
      } catch (loadError) {
        setSummary(null);
        setError(
          getErrorMessage(loadError),
        );
      } finally {
        setLoading(false);
      }
    }, []);

  React.useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const roster = summary?.roster ?? null;
  const cycle =
    summary?.current_cycle ?? null;

  const isOnSite =
    cycle?.status === 'ON_SITE';

  const progressPercent = Math.max(
    0,
    Math.min(
      100,
      Number(
        cycle?.progress_percent ?? 0,
      ),
    ),
  );

  return (
    <div className="min-h-full bg-gray-50">
      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-medium text-blue-600">
              Employee Self-Service
            </p>

            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-950">
              My Roster &amp; OS
            </h1>

            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              Data ini hanya menampilkan roster, cycle, dan saldo OS milik akun Anda.
              Seluruh informasi bersifat read-only.
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => {
              void loadSummary();
            }}
            disabled={loading}
          >
            <RefreshCw
              className={cn(
                'mr-2 h-4 w-4',
                loading && 'animate-spin',
              )}
            />
            Refresh
          </Button>
        </div>

        {loading ? (
          <LoadingState />
        ) : error ? (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="text-red-700">
                Data belum dapat ditampilkan
              </CardTitle>

              <CardDescription>
                {error}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <p className="text-sm text-gray-600">
                Hubungi HR jika akun belum terhubung ke master employee,
                roster aktif, atau site cycle aktif.
              </p>
            </CardContent>
          </Card>
        ) : summary ? (
          <>
            <Card>
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-gray-950">
                    {summary.employee.employee_name}
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    {summary.employee.employee_code}
                    {' · '}
                    {summary.employee.department}
                    {' · '}
                    {summary.employee.job_title}
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className="w-fit border-blue-200 bg-blue-50 px-3 py-1 text-blue-700"
                >
                  Data per {formatDate(summary.as_of_date)}
                </Badge>
              </CardContent>
            </Card>

            {(
              !summary.data_quality
                .has_active_roster ||
              !summary.data_quality
                .has_active_cycle
            ) && (
              <Card className="border-amber-200 bg-amber-50">
                <CardHeader>
                  <CardTitle className="text-base text-amber-900">
                    Data roster belum lengkap
                  </CardTitle>

                  <CardDescription className="text-amber-700">
                    Active roster:
                    {' '}
                    {
                      summary.data_quality
                        .active_roster_assignment_count
                    }
                    {' · '}
                    Active cycle:
                    {' '}
                    {
                      summary.data_quality
                        .active_site_cycle_count
                    }
                    . Hubungi HR untuk pemeriksaan data.
                  </CardDescription>
                </CardHeader>
              </Card>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Roster Saya
                    </p>

                    <CalendarDays className="h-5 w-5 text-blue-600" />
                  </div>

                  <p className="mt-4 text-3xl font-bold text-gray-950">
                    {roster?.roster_code ?? '-'}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    {roster
                      ? `${roster.site_days} hari site · ${roster.leave_days} hari leave`
                      : 'Belum ada roster aktif'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Hari di Site
                    </p>

                    <Clock3 className="h-5 w-5 text-emerald-600" />
                  </div>

                  <p className="mt-4 text-3xl font-bold text-gray-950">
                    {isOnSite
                      ? cycle?.site_day_number ?? 0
                      : 0}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    {isOnSite
                      ? `Hari ke-${cycle?.site_day_number ?? 0} pada current cycle`
                      : `Status: ${getStatusLabel(cycle?.status)}`}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Planned Site Out
                    </p>

                    <TimerReset className="h-5 w-5 text-orange-600" />
                  </div>

                  <p className="mt-4 text-xl font-bold text-gray-950">
                    {formatDate(
                      cycle?.planned_site_out,
                    )}
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    {isOnSite
                      ? cycle &&
                        cycle.overstay_days > 0
                        ? `${cycle.overstay_days} hari potential overstay`
                        : `${cycle?.days_until_site_out ?? 0} hari menuju Site Out`
                      : 'Mengikuti current cycle'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Available OS
                    </p>

                    <WalletCards className="h-5 w-5 text-violet-600" />
                  </div>

                  <p className="mt-4 text-3xl font-bold text-gray-950">
                    {
                      summary.os_summary
                        .total_available_days
                    }
                  </p>

                  <p className="mt-2 text-sm text-gray-500">
                    {
                      summary.os_summary
                        .active_bucket_count
                    }
                    {' '}
                    active bucket
                  </p>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>
                      Current Cycle
                    </CardTitle>

                    <CardDescription>
                      Perhitungan Hari di Site menggunakan Actual Site In sebagai D1.
                    </CardDescription>
                  </div>

                  <Badge
                    variant="outline"
                    className={cn(
                      'font-normal',
                      getStatusClass(cycle?.status),
                    )}
                  >
                    {getStatusLabel(cycle?.status)}
                  </Badge>
                </div>
              </CardHeader>

              <CardContent>
                {cycle ? (
                  <div className="space-y-5">
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          Current Cycle
                        </p>

                        <p className="mt-1 font-semibold text-gray-950">
                          Cycle {cycle.cycle_number}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          Actual / Planned Site In
                        </p>

                        <p className="mt-1 font-semibold text-gray-950">
                          {formatDate(
                            cycle.actual_site_in ??
                              cycle.planned_site_in,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          Planned Leave
                        </p>

                        <p className="mt-1 font-semibold text-gray-950">
                          {formatDate(
                            cycle.planned_leave_start,
                          )}
                          {' — '}
                          {formatDate(
                            cycle.planned_leave_end,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-wide text-gray-400">
                          Remaining Site Days
                        </p>

                        <p className="mt-1 font-semibold text-gray-950">
                          {isOnSite
                            ? cycle.days_until_site_out
                            : 0}
                          {' hari'}
                        </p>
                      </div>
                    </div>

                    {isOnSite && roster && (
                      <div>
                        <div className="mb-2 flex items-center justify-between gap-4 text-sm">
                          <span className="text-gray-500">
                            Progress current site period
                          </span>

                          <span className="font-medium text-gray-900">
                            Hari {cycle.site_day_number}
                            {' / '}
                            {roster.site_days}
                          </span>
                        </div>

                        <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                          <div
                            className="h-full rounded-full bg-gray-900 transition-all"
                            style={{
                              width: `${progressPercent}%`,
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="Belum ada active site cycle"
                    description="HR perlu membuat atau memperbaiki active site cycle Anda."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-violet-50 p-2 text-violet-700">
                    <WalletCards className="h-5 w-5" />
                  </div>

                  <div>
                    <CardTitle>
                      Active OS Balance
                    </CardTitle>

                    <CardDescription>
                      Saldo OS yang masih dapat digunakan. Penggunaan OS tetap diproses oleh HR.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {summary.active_os_buckets.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="min-w-full">
                      <thead className="border-b bg-gray-50">
                        <tr className="text-left text-xs uppercase tracking-wide text-gray-500">
                          <th className="px-4 py-3 font-medium">
                            OS
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Generated
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Cycle
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Remaining
                          </th>
                          <th className="px-4 py-3 font-medium">
                            Status
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {summary.active_os_buckets.map(
                          (bucket) => (
                            <OSBucketRow
                              key={bucket.id}
                              bucket={bucket}
                            />
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    title="Belum ada saldo OS aktif"
                    description="OS akan tampil setelah terbentuk dari Overstay, Early Recall, atau adjustment HR yang sah."
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-blue-50 p-2 text-blue-700">
                    <History className="h-5 w-5" />
                  </div>

                  <div>
                    <CardTitle>
                      Cycle History
                    </CardTitle>

                    <CardDescription>
                      Riwayat cycle terbaru dari data roster Anda.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {summary.cycle_history.length > 0 ? (
                  <div className="grid gap-4 lg:grid-cols-2">
                    {summary.cycle_history.map(
                      (item) => (
                        <CycleHistoryCard
                          key={item.id}
                          item={item}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <EmptyState
                    title="Belum ada cycle history"
                    description="Riwayat akan tampil setelah site cycle tersedia."
                  />
                )}
              </CardContent>
            </Card>

            <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-800">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />

              <p>
                Halaman ini read-only. Employee tidak dapat mengubah roster,
                tanggal movement, atau saldo OS dari halaman ini.
              </p>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
};

export default MyRosterOSPage;
