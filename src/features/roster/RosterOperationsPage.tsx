import React from 'react';
import {
  AlertTriangle,
  CalendarCheck2,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  confirmRosterLeaveStart,
  confirmRosterReturn,
  confirmRosterSiteOut,
  consumeEmployeeOS,
  dispatchRosterOperationsUpdated,
  getActiveOSLedger,
  getLocalDateInputValue,
  getRosterAttentionQueue,
  type OSLedgerItem,
  type RosterAttentionActionCode,
  type RosterAttentionQueueItem,
} from '@/lib/rosterOperationsApi';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store';

interface EmployeeOSSummary {
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  department: string;
  jobTitle: string;
  totalRemainingDays: number;
  bucketCount: number;
  oldestGeneratedDate: string | null;
  latestCycleNumber: number;
  buckets: OSLedgerItem[];
}

interface MovementDialogState {
  item: RosterAttentionQueueItem;
  date: string;
  trfId: string;
  remarks: string;
}

interface ConsumeDialogState {
  employee: EmployeeOSSummary;
  requestedDays: string;
  referenceType: string;
  referenceNumber: string;
  remarks: string;
  operationKey: string;
}

const ACTION_LABELS: Record<
  RosterAttentionActionCode,
  string
> = {
  RETURN_TO_SITE_CONFIRMATION_REQUIRED:
    'Return to Site perlu dikonfirmasi',
  TRAVEL_OUT_CONFIRMATION_REQUIRED:
    'Leave Start perlu dikonfirmasi',
  POTENTIAL_OVERSTAY:
    'Potential Overstay',
  SITE_OUT_DUE_TODAY:
    'Site Out jatuh tempo hari ini',
};

const ACTION_SHORT_LABELS: Record<
  RosterAttentionActionCode,
  string
> = {
  RETURN_TO_SITE_CONFIRMATION_REQUIRED:
    'Confirm Return / D1',
  TRAVEL_OUT_CONFIRMATION_REQUIRED:
    'Confirm Leave Start',
  POTENTIAL_OVERSTAY:
    'Confirm Site Out',
  SITE_OUT_DUE_TODAY:
    'Confirm Site Out',
};

const ACTION_ORDER: RosterAttentionActionCode[] = [
  'RETURN_TO_SITE_CONFIRMATION_REQUIRED',
  'TRAVEL_OUT_CONFIRMATION_REQUIRED',
  'POTENTIAL_OVERSTAY',
  'SITE_OUT_DUE_TODAY',
];

const getActionBadgeClass = (
  actionCode: RosterAttentionActionCode,
): string => {
  switch (actionCode) {
    case 'RETURN_TO_SITE_CONFIRMATION_REQUIRED':
      return 'border-red-200 bg-red-50 text-red-700';

    case 'TRAVEL_OUT_CONFIRMATION_REQUIRED':
      return 'border-amber-200 bg-amber-50 text-amber-700';

    case 'POTENTIAL_OVERSTAY':
      return 'border-orange-200 bg-orange-50 text-orange-700';

    case 'SITE_OUT_DUE_TODAY':
      return 'border-blue-200 bg-blue-50 text-blue-700';

    default:
      return 'border-gray-200 bg-gray-50 text-gray-700';
  }
};

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
    : 'Operasi gagal diproses.';

const createOperationKey = (
  employeeId: string,
): string => {
  const suffix =
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return `ROSTER_UI:${employeeId}:${suffix}`;
};

const getMovementDialogTitle = (
  actionCode: RosterAttentionActionCode,
): string => {
  switch (actionCode) {
    case 'TRAVEL_OUT_CONFIRMATION_REQUIRED':
      return 'Konfirmasi Actual Leave Start';

    case 'RETURN_TO_SITE_CONFIRMATION_REQUIRED':
      return 'Konfirmasi Return to Site / D1';

    case 'POTENTIAL_OVERSTAY':
    case 'SITE_OUT_DUE_TODAY':
      return 'Konfirmasi Actual Site Out';

    default:
      return 'Konfirmasi Movement';
  }
};

const getMovementDateLabel = (
  actionCode: RosterAttentionActionCode,
): string => {
  switch (actionCode) {
    case 'TRAVEL_OUT_CONFIRMATION_REQUIRED':
      return 'Actual Leave Start';

    case 'RETURN_TO_SITE_CONFIRMATION_REQUIRED':
      return 'Return to Site / D1';

    case 'POTENTIAL_OVERSTAY':
    case 'SITE_OUT_DUE_TODAY':
      return 'Actual Site Out';

    default:
      return 'Tanggal Aktual';
  }
};

const shouldShowTrfId = (
  actionCode: RosterAttentionActionCode,
): boolean =>
  actionCode !==
  'TRAVEL_OUT_CONFIRMATION_REQUIRED';

const getTrfLabel = (
  actionCode: RosterAttentionActionCode,
): string =>
  actionCode ===
  'RETURN_TO_SITE_CONFIRMATION_REQUIRED'
    ? 'Site-In TRF ID (opsional)'
    : 'Site-Out TRF ID (opsional)';

const RosterOperationsPage: React.FC = () => {
  const currentUser = useAuthStore(
    (state) => state.currentUser,
  );

  const canManageOS =
    currentUser?.role === 'HR' ||
    currentUser?.role === 'SUPER_ADMIN';

  const [activeTab, setActiveTab] =
    React.useState<'queue' | 'os'>('queue');

  const [asOfDate, setAsOfDate] =
    React.useState(
      getLocalDateInputValue(),
    );

  const [queueItems, setQueueItems] =
    React.useState<
      RosterAttentionQueueItem[]
    >([]);

  const [ledgerItems, setLedgerItems] =
    React.useState<OSLedgerItem[]>([]);

  const [queueLoading, setQueueLoading] =
    React.useState(false);

  const [ledgerLoading, setLedgerLoading] =
    React.useState(false);

  const [queueSearch, setQueueSearch] =
    React.useState('');

  const [queueActionFilter, setQueueActionFilter] =
    React.useState<
      'ALL' | RosterAttentionActionCode
    >('ALL');

  const [movementDialog, setMovementDialog] =
    React.useState<
      MovementDialogState | null
    >(null);

  const [consumeDialog, setConsumeDialog] =
    React.useState<ConsumeDialogState | null>(
      null,
    );

  const [mutationLoading, setMutationLoading] =
    React.useState(false);

  const loadQueue = React.useCallback(
    async (
      options: {
        silent?: boolean;
      } = {},
    ) => {
      if (!currentUser) return;

      setQueueLoading(true);

      try {
        const response =
          await getRosterAttentionQueue(
            asOfDate,
          );

        setQueueItems(response.items);
      } catch (error) {
        setQueueItems([]);

        if (!options.silent) {
          toast.error(
            getErrorMessage(error),
          );
        }
      } finally {
        setQueueLoading(false);
      }
    }, [asOfDate, currentUser?.id]);

  const loadLedger = React.useCallback(
    async (
      options: {
        silent?: boolean;
      } = {},
    ) => {
      if (!canManageOS) {
        setLedgerItems([]);
        return;
      }

      setLedgerLoading(true);

      try {
        const response =
          await getActiveOSLedger();

        setLedgerItems(response.items);
      } catch (error) {
        setLedgerItems([]);

        if (!options.silent) {
          toast.error(
            getErrorMessage(error),
          );
        }
      } finally {
        setLedgerLoading(false);
      }
    }, [canManageOS]);

  React.useEffect(() => {
    void loadQueue({ silent: true });
  }, [loadQueue]);

  React.useEffect(() => {
    if (canManageOS) {
      void loadLedger({ silent: true });
    }
  }, [canManageOS, loadLedger]);

  const queueCounts = React.useMemo(() => {
    const counts = ACTION_ORDER.reduce<
      Record<RosterAttentionActionCode, number>
    >(
      (result, actionCode) => {
        result[actionCode] = 0;
        return result;
      },
      {} as Record<
        RosterAttentionActionCode,
        number
      >,
    );

    queueItems.forEach((item) => {
      counts[item.action_code] += 1;
    });

    return counts;
  }, [queueItems]);

  const filteredQueueItems = React.useMemo(() => {
    const keyword = queueSearch
      .trim()
      .toLowerCase();

    return queueItems.filter((item) => {
      if (
        queueActionFilter !== 'ALL' &&
        item.action_code !== queueActionFilter
      ) {
        return false;
      }

      if (!keyword) return true;

      return [
        item.employee_code,
        item.employee_name,
        item.department,
        item.roster_code,
        item.source_reference ?? '',
      ].some((value) =>
        value
          .toLowerCase()
          .includes(keyword),
      );
    });
  }, [
    queueActionFilter,
    queueItems,
    queueSearch,
  ]);

  const employeeOSSummaries =
    React.useMemo<EmployeeOSSummary[]>(() => {
      const summaryMap = new Map<
        string,
        EmployeeOSSummary
      >();

      ledgerItems.forEach((item) => {
        const existing = summaryMap.get(
          item.employee_id,
        );

        if (existing) {
          existing.totalRemainingDays +=
            item.remaining_days;
          existing.bucketCount += 1;
          existing.latestCycleNumber =
            Math.max(
              existing.latestCycleNumber,
              item.cycle_number,
            );
          existing.buckets.push(item);
          return;
        }

        summaryMap.set(item.employee_id, {
          employeeId: item.employee_id,
          employeeCode:
            item.employee?.employee_code ?? '-',
          employeeName:
            item.employee?.employee_name ??
            'Unknown Employee',
          department:
            item.employee?.department ?? '-',
          jobTitle:
            item.employee?.job_title ?? '-',
          totalRemainingDays:
            item.remaining_days,
          bucketCount: 1,
          oldestGeneratedDate:
            item.generated_date,
          latestCycleNumber:
            item.cycle_number,
          buckets: [item],
        });
      });

      return Array.from(summaryMap.values()).sort(
        (first, second) =>
          first.employeeCode.localeCompare(
            second.employeeCode,
          ),
      );
    }, [ledgerItems]);

  const totalRemainingOS = React.useMemo(
    () =>
      ledgerItems.reduce(
        (total, item) =>
          total + item.remaining_days,
        0,
      ),
    [ledgerItems],
  );

  const openMovementDialog = (
    item: RosterAttentionQueueItem,
  ) => {
    const defaultDate =
      item.action_code ===
      'TRAVEL_OUT_CONFIRMATION_REQUIRED'
        ? item.actual_site_out ?? asOfDate
        : asOfDate;

    setMovementDialog({
      item,
      date: defaultDate,
      trfId: '',
      remarks: '',
    });
  };

  const submitMovement = async () => {
    if (!movementDialog) return;

    const { item, date, trfId, remarks } =
      movementDialog;

    if (!date) {
      toast.error('Tanggal aktual wajib diisi.');
      return;
    }

    if (remarks.trim().length < 3) {
      toast.error(
        'Remarks wajib diisi minimal 3 karakter.',
      );
      return;
    }

    setMutationLoading(true);

    try {
      switch (item.action_code) {
        case 'TRAVEL_OUT_CONFIRMATION_REQUIRED':
          await confirmRosterLeaveStart({
            siteCycleId: item.site_cycle_id,
            actualLeaveStart: date,
            remarks: remarks.trim(),
          });
          break;

        case 'RETURN_TO_SITE_CONFIRMATION_REQUIRED':
          await confirmRosterReturn({
            siteCycleId: item.site_cycle_id,
            returnToSiteDate: date,
            siteInTrfId:
              trfId.trim() || null,
            remarks: remarks.trim(),
          });
          break;

        case 'POTENTIAL_OVERSTAY':
        case 'SITE_OUT_DUE_TODAY':
          await confirmRosterSiteOut({
            siteCycleId: item.site_cycle_id,
            actualSiteOut: date,
            siteOutTrfId:
              trfId.trim() || null,
            remarks: remarks.trim(),
          });
          break;

        default:
          throw new Error(
            'Action queue tidak didukung.',
          );
      }

      toast.success(
        'Konfirmasi Roster berhasil disimpan.',
      );

      setMovementDialog(null);
      await loadQueue({ silent: true });

      if (canManageOS) {
        await loadLedger({ silent: true });
      }

      dispatchRosterOperationsUpdated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMutationLoading(false);
    }
  };

  const openConsumeDialog = (
    employee: EmployeeOSSummary,
  ) => {
    setConsumeDialog({
      employee,
      requestedDays: '1',
      referenceType: 'MANUAL_OS_USAGE',
      referenceNumber: '',
      remarks: '',
      operationKey: createOperationKey(
        employee.employeeId,
      ),
    });
  };

  const submitConsumeOS = async () => {
    if (!consumeDialog) return;

    const requestedDays = Number(
      consumeDialog.requestedDays,
    );

    if (
      !Number.isInteger(requestedDays) ||
      requestedDays <= 0
    ) {
      toast.error(
        'Jumlah OS harus berupa bilangan bulat lebih dari 0.',
      );
      return;
    }

    if (
      requestedDays >
      consumeDialog.employee.totalRemainingDays
    ) {
      toast.error(
        'Jumlah OS melebihi saldo yang tersedia.',
      );
      return;
    }

    if (
      consumeDialog.remarks.trim().length < 3
    ) {
      toast.error(
        'Remarks wajib diisi minimal 3 karakter.',
      );
      return;
    }

    setMutationLoading(true);

    try {
      await consumeEmployeeOS({
        employeeId:
          consumeDialog.employee.employeeId,
        requestedDays,
        operationKey:
          consumeDialog.operationKey,
        referenceType:
          consumeDialog.referenceType,
        referenceNumber:
          consumeDialog.referenceNumber.trim() ||
          null,
        remarks:
          consumeDialog.remarks.trim(),
      });

      toast.success(
        'Pemakaian OS berhasil diproses dengan FIFO.',
      );

      setConsumeDialog(null);
      await loadLedger({ silent: true });
      await loadQueue({ silent: true });
      dispatchRosterOperationsUpdated();
    } catch (error) {
      toast.error(getErrorMessage(error));
    } finally {
      setMutationLoading(false);
    }
  };

  const refreshActiveTab = async () => {
    if (activeTab === 'os' && canManageOS) {
      await loadLedger();
      return;
    }

    await loadQueue();
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Roster &amp; OS Operations
          </h1>

          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Attention Queue hanya memberi peringatan.
            Perubahan cycle dan OS baru terjadi setelah
            konfirmasi aktual disimpan melalui RPC production.
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={() => void refreshActiveTab()}
          disabled={
            queueLoading ||
            ledgerLoading ||
            mutationLoading
          }
        >
          <RefreshCw
            className={cn(
              'mr-2 h-4 w-4',
              (queueLoading || ledgerLoading) &&
                'animate-spin',
            )}
          />
          Refresh
        </Button>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(value) =>
          setActiveTab(value as 'queue' | 'os')
        }
      >
        <TabsList>
          <TabsTrigger value="queue">
            Attention Queue
          </TabsTrigger>

          {canManageOS && (
            <TabsTrigger value="os">
              OS Ledger
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent
          value="queue"
          className="mt-6 space-y-6"
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {ACTION_ORDER.map((actionCode) => (
              <button
                key={actionCode}
                type="button"
                onClick={() =>
                  setQueueActionFilter(
                    queueActionFilter === actionCode
                      ? 'ALL'
                      : actionCode,
                  )
                }
                className={cn(
                  'rounded-xl border bg-white p-4 text-left shadow-sm transition hover:border-gray-300 hover:shadow',
                  queueActionFilter === actionCode &&
                    'ring-2 ring-blue-500 ring-offset-1',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      {ACTION_LABELS[actionCode]}
                    </p>

                    <p className="mt-2 text-2xl font-semibold text-gray-900">
                      {queueCounts[actionCode]}
                    </p>
                  </div>

                  {actionCode ===
                  'RETURN_TO_SITE_CONFIRMATION_REQUIRED' ? (
                    <CalendarCheck2 className="h-5 w-5 text-red-500" />
                  ) : actionCode ===
                    'TRAVEL_OUT_CONFIRMATION_REQUIRED' ? (
                    <Clock3 className="h-5 w-5 text-amber-500" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <CardTitle>
                    Operational Attention Queue
                  </CardTitle>

                  <CardDescription>
                    Snapshot per {formatDate(asOfDate)}.
                    Total {queueItems.length} item membutuhkan
                    pemeriksaan atau konfirmasi.
                  </CardDescription>
                </div>

                <div className="grid gap-3 sm:grid-cols-[180px_minmax(240px,1fr)]">
                  <div className="space-y-1.5">
                    <Label htmlFor="roster-as-of-date">
                      As-of Date
                    </Label>

                    <Input
                      id="roster-as-of-date"
                      type="date"
                      value={asOfDate}
                      onChange={(event) =>
                        setAsOfDate(
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="roster-search">
                      Search
                    </Label>

                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

                      <Input
                        id="roster-search"
                        value={queueSearch}
                        onChange={(event) =>
                          setQueueSearch(
                            event.target.value,
                          )
                        }
                        placeholder="ID, nama, departemen..."
                        className="pl-9"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              {queueLoading ? (
                <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Mengambil attention queue...
                </div>
              ) : filteredQueueItems.length === 0 ? (
                <div className="rounded-lg border border-dashed p-10 text-center">
                  <ShieldCheck className="mx-auto h-9 w-9 text-emerald-500" />

                  <p className="mt-3 font-medium text-gray-900">
                    Tidak ada item pada filter ini
                  </p>

                  <p className="mt-1 text-sm text-gray-500">
                    Hapus filter atau ubah As-of Date untuk
                    melihat snapshot lain.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1080px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                        <th className="px-3 py-3">
                          Employee
                        </th>
                        <th className="px-3 py-3">
                          Action
                        </th>
                        <th className="px-3 py-3">
                          Roster / Cycle
                        </th>
                        <th className="px-3 py-3">
                          Planned / Actual
                        </th>
                        <th className="px-3 py-3">
                          Exposure
                        </th>
                        <th className="px-3 py-3 text-right">
                          Process
                        </th>
                      </tr>
                    </thead>

                    <tbody>
                      {filteredQueueItems.map((item) => (
                        <tr
                          key={`${item.action_code}:${item.site_cycle_id}`}
                          className="border-b align-top last:border-0 hover:bg-gray-50/70"
                        >
                          <td className="px-3 py-4">
                            <p className="font-medium text-gray-900">
                              {item.employee_name}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              {item.employee_code} ·{' '}
                              {item.department}
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <Badge
                              variant="outline"
                              className={getActionBadgeClass(
                                item.action_code,
                              )}
                            >
                              {ACTION_LABELS[
                                item.action_code
                              ]}
                            </Badge>

                            <p className="mt-2 text-xs text-gray-500">
                              Current status:{' '}
                              {item.cycle_status}
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <p className="font-medium text-gray-900">
                              {item.roster_code}
                            </p>

                            <p className="mt-1 text-xs text-gray-500">
                              Cycle {item.cycle_number}
                            </p>
                          </td>

                          <td className="px-3 py-4 text-xs leading-5 text-gray-600">
                            <p>
                              Site Out:{' '}
                              {formatDate(
                                item.planned_site_out,
                              )}
                              {' / '}
                              {formatDate(
                                item.actual_site_out,
                              )}
                            </p>

                            <p>
                              Leave:{' '}
                              {formatDate(
                                item.planned_leave_start,
                              )}
                              {' – '}
                              {formatDate(
                                item.planned_leave_end,
                              )}
                            </p>
                          </td>

                          <td className="px-3 py-4">
                            <p className="font-medium text-gray-900">
                              {item.days_overdue > 0
                                ? `${item.days_overdue} hari overdue`
                                : 'Due today / follow-up'}
                            </p>

                            {item.projected_os_days > 0 && (
                              <p className="mt-1 text-xs font-medium text-orange-600">
                                Projected OS:{' '}
                                {item.projected_os_days} hari
                              </p>
                            )}
                          </td>

                          <td className="px-3 py-4 text-right">
                            <Button
                              type="button"
                              size="sm"
                              onClick={() =>
                                openMovementDialog(
                                  item,
                                )
                              }
                            >
                              {
                                ACTION_SHORT_LABELS[
                                  item.action_code
                                ]
                              }
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManageOS && (
          <TabsContent
            value="os"
            className="mt-6 space-y-6"
          >
            <div className="grid gap-3 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    Employee dengan saldo
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {employeeOSSummaries.length}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    Active OS buckets
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {ledgerItems.length}
                  </CardTitle>
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardDescription>
                    Total OS available
                  </CardDescription>
                  <CardTitle className="text-2xl">
                    {totalRemainingOS} hari
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle>
                      Active OS Ledger
                    </CardTitle>

                    <CardDescription>
                      Pemakaian OS diproses FIFO dari bucket
                      yang paling lama.
                    </CardDescription>
                  </div>

                  <WalletCards className="h-6 w-6 text-blue-600" />
                </div>
              </CardHeader>

              <CardContent>
                {ledgerLoading ? (
                  <div className="flex min-h-48 items-center justify-center text-sm text-gray-500">
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Mengambil saldo OS...
                  </div>
                ) : employeeOSSummaries.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-10 text-center text-sm text-gray-500">
                    Tidak ada saldo OS aktif.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[900px] border-collapse text-sm">
                      <thead>
                        <tr className="border-b bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                          <th className="px-3 py-3">
                            Employee
                          </th>
                          <th className="px-3 py-3">
                            Department / Position
                          </th>
                          <th className="px-3 py-3">
                            Buckets
                          </th>
                          <th className="px-3 py-3">
                            Oldest Generated
                          </th>
                          <th className="px-3 py-3">
                            Available
                          </th>
                          <th className="px-3 py-3 text-right">
                            Action
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {employeeOSSummaries.map(
                          (employee) => (
                            <tr
                              key={employee.employeeId}
                              className="border-b align-top last:border-0 hover:bg-gray-50/70"
                            >
                              <td className="px-3 py-4">
                                <p className="font-medium text-gray-900">
                                  {employee.employeeName}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  {employee.employeeCode}
                                </p>
                              </td>

                              <td className="px-3 py-4">
                                <p className="text-gray-900">
                                  {employee.department}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  {employee.jobTitle}
                                </p>
                              </td>

                              <td className="px-3 py-4">
                                {employee.bucketCount}
                                <span className="ml-1 text-xs text-gray-500">
                                  bucket · latest C
                                  {employee.latestCycleNumber}
                                </span>
                              </td>

                              <td className="px-3 py-4">
                                {formatDate(
                                  employee.oldestGeneratedDate,
                                )}
                              </td>

                              <td className="px-3 py-4">
                                <span className="text-lg font-semibold text-gray-900">
                                  {
                                    employee.totalRemainingDays
                                  }
                                </span>
                                <span className="ml-1 text-xs text-gray-500">
                                  hari
                                </span>
                              </td>

                              <td className="px-3 py-4 text-right">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    openConsumeDialog(
                                      employee,
                                    )
                                  }
                                >
                                  Use OS
                                </Button>
                              </td>
                            </tr>
                          ),
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Dialog
        open={Boolean(movementDialog)}
        onOpenChange={(open) => {
          if (!open && !mutationLoading) {
            setMovementDialog(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {movementDialog && (
            <>
              <DialogHeader>
                <DialogTitle>
                  {getMovementDialogTitle(
                    movementDialog.item.action_code,
                  )}
                </DialogTitle>

                <DialogDescription>
                  {movementDialog.item.employee_code} ·{' '}
                  {movementDialog.item.employee_name} ·{' '}
                  Roster{' '}
                  {movementDialog.item.roster_code} · Cycle{' '}
                  {movementDialog.item.cycle_number}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label htmlFor="movement-date">
                    {getMovementDateLabel(
                      movementDialog.item.action_code,
                    )}
                  </Label>

                  <Input
                    id="movement-date"
                    type="date"
                    value={movementDialog.date}
                    onChange={(event) =>
                      setMovementDialog((current) =>
                        current
                          ? {
                              ...current,
                              date: event.target.value,
                            }
                          : null,
                      )
                    }
                  />
                </div>

                {shouldShowTrfId(
                  movementDialog.item.action_code,
                ) && (
                  <div className="space-y-1.5">
                    <Label htmlFor="movement-trf-id">
                      {getTrfLabel(
                        movementDialog.item.action_code,
                      )}
                    </Label>

                    <Input
                      id="movement-trf-id"
                      value={movementDialog.trfId}
                      onChange={(event) =>
                        setMovementDialog((current) =>
                          current
                            ? {
                                ...current,
                                trfId:
                                  event.target.value,
                              }
                            : null,
                        )
                      }
                      placeholder="UUID TRF — boleh dikosongkan"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="movement-remarks">
                    Remarks
                  </Label>

                  <Textarea
                    id="movement-remarks"
                    value={movementDialog.remarks}
                    onChange={(event) =>
                      setMovementDialog((current) =>
                        current
                          ? {
                              ...current,
                              remarks:
                                event.target.value,
                            }
                          : null,
                      )
                    }
                    placeholder="Dasar konfirmasi, tiket, atau keterangan operasional..."
                    rows={4}
                  />
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                  Tindakan ini mengubah data production.
                  Pastikan tanggal aktual dan employee sudah
                  benar sebelum menekan Confirm.
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setMovementDialog(null)
                  }
                  disabled={mutationLoading}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    void submitMovement()
                  }
                  disabled={mutationLoading}
                >
                  {mutationLoading && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Confirm
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(consumeDialog)}
        onOpenChange={(open) => {
          if (!open && !mutationLoading) {
            setConsumeDialog(null);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          {consumeDialog && (
            <>
              <DialogHeader>
                <DialogTitle>
                  Use Employee OS
                </DialogTitle>

                <DialogDescription>
                  {consumeDialog.employee.employeeCode} ·{' '}
                  {consumeDialog.employee.employeeName} ·
                  Available{' '}
                  {
                    consumeDialog.employee
                      .totalRemainingDays
                  }{' '}
                  hari
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="consume-days">
                      Jumlah OS
                    </Label>

                    <Input
                      id="consume-days"
                      type="number"
                      min={1}
                      max={
                        consumeDialog.employee
                          .totalRemainingDays
                      }
                      step={1}
                      value={
                        consumeDialog.requestedDays
                      }
                      onChange={(event) =>
                        setConsumeDialog((current) =>
                          current
                            ? {
                                ...current,
                                requestedDays:
                                  event.target.value,
                              }
                            : null,
                        )
                      }
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="consume-reference-type">
                      Reference Type
                    </Label>

                    <select
                      id="consume-reference-type"
                      value={
                        consumeDialog.referenceType
                      }
                      onChange={(event) =>
                        setConsumeDialog((current) =>
                          current
                            ? {
                                ...current,
                                referenceType:
                                  event.target.value,
                              }
                            : null,
                        )
                      }
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      <option value="MANUAL_OS_USAGE">
                        Manual OS Usage
                      </option>
                      <option value="LEAVE">
                        Leave
                      </option>
                      <option value="TRF">
                        TRF
                      </option>
                      <option value="OTHER">
                        Other
                      </option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="consume-reference-number">
                    Reference Number (opsional)
                  </Label>

                  <Input
                    id="consume-reference-number"
                    value={
                      consumeDialog.referenceNumber
                    }
                    onChange={(event) =>
                      setConsumeDialog((current) =>
                        current
                          ? {
                              ...current,
                              referenceNumber:
                                event.target.value,
                            }
                          : null,
                      )
                    }
                    placeholder="Contoh: LEAVE-2026-001"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="consume-remarks">
                    Remarks
                  </Label>

                  <Textarea
                    id="consume-remarks"
                    value={consumeDialog.remarks}
                    onChange={(event) =>
                      setConsumeDialog((current) =>
                        current
                          ? {
                              ...current,
                              remarks:
                                event.target.value,
                            }
                          : null,
                      )
                    }
                    placeholder="Alasan dan dasar pemakaian OS..."
                    rows={4}
                  />
                </div>

                <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs leading-5 text-blue-800">
                  Sistem akan memakai bucket OS tertua terlebih
                  dahulu. Operation key disimpan agar request yang
                  sama tetap idempotent.
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setConsumeDialog(null)
                  }
                  disabled={mutationLoading}
                >
                  Cancel
                </Button>

                <Button
                  type="button"
                  onClick={() =>
                    void submitConsumeOS()
                  }
                  disabled={mutationLoading}
                >
                  {mutationLoading && (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Process FIFO
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RosterOperationsPage;
