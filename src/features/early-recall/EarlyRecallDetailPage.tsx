import React from 'react';
import {
  useNavigate,
  useParams,
} from 'react-router-dom';

import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  CalendarDays,
  CheckCircle2,
  CircleDollarSign,
  Clock3,
  Edit,
  ExternalLink,
  FileCheck2,
  History,
  Loader2,
  MapPin,
  MessageSquareText,
  Phone,
  Plane,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Undo2,
  UserCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import {
  acknowledgeEarlyRecall,
  approveEarlyRecallByPM,
  cancelEarlyRecall,
  confirmEarlyRecallActualReturn,
  getEarlyRecallDetail,
  markEarlyRecallTravelBooked,
  rejectEarlyRecall,
  returnEarlyRecallForRevision,
  startEarlyRecallGAProcessing,
  submitEarlyRecall,
  validateEarlyRecallByHR,
  type EarlyRecallHistoryRecord,
  type EarlyRecallNotificationResult,
  type EarlyRecallRecord,
} from '@/lib/earlyRecallApi';
import { useAuthStore } from '@/store';
import type {
  UserRole,
} from '@/types';

import EarlyRecallStatusBadge, {
  getEarlyRecallStatusDescription,
} from './components/EarlyRecallStatusBadge';

type DialogAction =
  | 'SUBMIT'
  | 'HR_VALIDATE'
  | 'RETURN_REVISION'
  | 'PM_APPROVE'
  | 'GA_START'
  | 'TRAVEL_BOOKED'
  | 'ACKNOWLEDGE'
  | 'CONFIRM_RETURN'
  | 'REJECT'
  | 'CANCEL';

interface DialogConfig {
  title: string;
  description: string;
  confirmText: string;
  confirmClassName?: string;
  requiresRemarks?: boolean;
  remarksLabel?: string;
  remarksPlaceholder?: string;
  requiresDate?: boolean;
}

const DIALOG_CONFIG: Record<
  DialogAction,
  DialogConfig
> = {
  SUBMIT: {
    title: 'Submit Early Recall',
    description:
      'Permintaan akan dikirim ke HR untuk validasi approved leave dan estimasi sisa cuti.',
    confirmText: 'Submit to HR',
    remarksLabel: 'Submission Remarks',
    remarksPlaceholder:
      'Catatan tambahan untuk HR (opsional)...',
  },

  HR_VALIDATE: {
    title: 'Validate Early Recall',
    description:
      'HR mengonfirmasi periode cuti dan estimasi sisa cuti. Setelah validasi, permintaan diteruskan ke PM.',
    confirmText: 'Validate & Forward',
    confirmClassName:
      'bg-green-600 hover:bg-green-700',
    remarksLabel: 'HR Validation Remarks',
    remarksPlaceholder:
      'Catatan hasil validasi HR (opsional)...',
  },

  RETURN_REVISION: {
    title: 'Return for Revision',
    description:
      'Permintaan dikembalikan kepada requester untuk diperbaiki.',
    confirmText: 'Return for Revision',
    confirmClassName:
      'bg-amber-600 hover:bg-amber-700',
    requiresRemarks: true,
    remarksLabel: 'Revision Reason',
    remarksPlaceholder:
      'Jelaskan data yang harus diperbaiki...',
  },

  PM_APPROVE: {
    title: 'Approve Early Recall',
    description:
      'Setelah disetujui, sistem otomatis membuat linked Travel-In TRF berstatus PM Approved untuk diproses GA. Employee menerima notifikasi WhatsApp.',
    confirmText: 'Approve Early Recall',
    confirmClassName:
      'bg-green-600 hover:bg-green-700',
    remarksLabel: 'PM Approval Remarks',
    remarksPlaceholder:
      'Catatan persetujuan PM (opsional)...',
  },

  GA_START: {
    title: 'Start GA Processing',
    description:
      'GA mulai memproses tiket dan travel arrangement pada linked Travel-In TRF.',
    confirmText: 'Start Processing',
    confirmClassName:
      'bg-orange-600 hover:bg-orange-700',
    remarksLabel: 'GA Remarks',
    remarksPlaceholder:
      'Catatan awal proses GA (opsional)...',
  },

  TRAVEL_BOOKED: {
    title: 'Mark Travel as Booked',
    description:
      'Pastikan linked Travel-In TRF sudah berstatus GA Processed. Employee akan menerima detail perjalanan melalui WhatsApp.',
    confirmText: 'Mark Travel Booked',
    confirmClassName:
      'bg-sky-600 hover:bg-sky-700',
    remarksLabel: 'Travel Remarks',
    remarksPlaceholder:
      'Keterangan perjalanan untuk employee (opsional)...',
  },

  ACKNOWLEDGE: {
    title: 'Acknowledge Early Recall',
    description:
      'Konfirmasi bahwa Anda sudah mengetahui instruksi Early Recall dan jadwal kembali ke site.',
    confirmText: 'Saya Sudah Mengetahui',
    confirmClassName:
      'bg-blue-600 hover:bg-blue-700',
  },

  CONFIRM_RETURN: {
    title: 'Confirm Actual Return',
    description:
      'Tanggal aktual menjadi dasar perhitungan sisa cuti. Setelah dikonfirmasi, sistem otomatis membentuk OS Cycle 0 dan mengirim notifikasi WhatsApp.',
    confirmText: 'Confirm & Generate OS',
    confirmClassName:
      'bg-green-600 hover:bg-green-700',
    requiresDate: true,
    remarksLabel: 'Confirmation Remarks',
    remarksPlaceholder:
      'Catatan actual return (opsional)...',
  },

  REJECT: {
    title: 'Reject Early Recall',
    description:
      'Permintaan akan ditutup sebagai Rejected dan tidak dapat dilanjutkan.',
    confirmText: 'Reject Request',
    confirmClassName:
      'bg-red-600 hover:bg-red-700',
    requiresRemarks: true,
    remarksLabel: 'Rejection Reason',
    remarksPlaceholder:
      'Masukkan alasan penolakan...',
  },

  CANCEL: {
    title: 'Cancel Early Recall',
    description:
      'Permintaan akan dibatalkan. Jika employee sudah menerima pemberitahuan resmi, sistem juga mengirim notifikasi pembatalan.',
    confirmText: 'Cancel Early Recall',
    confirmClassName:
      'bg-red-600 hover:bg-red-700',
    requiresRemarks: true,
    remarksLabel: 'Cancellation Reason',
    remarksPlaceholder:
      'Masukkan alasan pembatalan...',
  },
};

const formatDate = (
  value?: string | null,
  withTime = false,
): string => {
  if (!value) {
    return '-';
  }

  const dateOnlyMatch =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  const date = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      )
    : new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return value;
  }

  return new Intl.DateTimeFormat(
    'id-ID',
    withTime
      ? {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }
      : {
          day: '2-digit',
          month: 'long',
          year: 'numeric',
        },
  ).format(date);
};

const getErrorMessage = (
  error: unknown,
  fallback: string,
): string =>
  error instanceof Error &&
  error.message
    ? error.message
    : fallback;

type EarlyRecallHistoryStringKey =
  | 'id'
  | 'from_status'
  | 'to_status'
  | 'actor_type'
  | 'changed_by_user_id'
  | 'changed_by_role'
  | 'remarks'
  | 'created_at';

const getHistoryValue = (
  item: EarlyRecallHistoryRecord,
  key: EarlyRecallHistoryStringKey,
): string | null => {
  const value = item[key];

  return typeof value === 'string'
    ? value
    : null;
};

const getNotificationSummary = (
  notifications:
    | EarlyRecallNotificationResult[]
    | undefined,
): void => {
  if (
    !notifications ||
    notifications.length === 0
  ) {
    return;
  }

  const failed =
    notifications.filter(
      (item) => !item.success,
    );

  if (failed.length > 0) {
    const first =
      failed[0];

    toast.warning(
      first.skippedReason ??
        first.error ??
        'Workflow berhasil, tetapi sebagian notifikasi WhatsApp gagal.',
    );
  } else {
    toast.success(
      'Notifikasi WhatsApp berhasil dikirim.',
    );
  }
};

const InfoRow: React.FC<{
  label: string;
  value:
    | React.ReactNode
    | string
    | number;
}> = ({
  label,
  value,
}) => (
  <div className="flex flex-col gap-1 border-b border-gray-100 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
    <dt className="text-sm text-gray-500">
      {label}
    </dt>

    <dd className="text-sm font-medium text-gray-900 sm:text-right">
      {value}
    </dd>
  </div>
);

const EarlyRecallDetailPage: React.FC =
  () => {
    const navigate = useNavigate();

    const {
      id: earlyRecallId,
    } = useParams<{
      id: string;
    }>();

    const currentUser = useAuthStore(
      (state) =>
        state.currentUser,
    );

    const [
      record,
      setRecord,
    ] = React.useState<
      EarlyRecallRecord | null
    >(null);

    const [
      isLoading,
      setIsLoading,
    ] = React.useState(true);

    const [
      isRefreshing,
      setIsRefreshing,
    ] = React.useState(false);

    const [
      isProcessing,
      setIsProcessing,
    ] = React.useState(false);

    const [
      activeAction,
      setActiveAction,
    ] = React.useState<
      DialogAction | null
    >(null);

    const [
      actionRemarks,
      setActionRemarks,
    ] = React.useState('');

    const [
      actualReturnDate,
      setActualReturnDate,
    ] = React.useState('');

    const loadRecord =
      React.useCallback(
        async (
          silent = false,
        ) => {
          if (
            !earlyRecallId
          ) {
            return;
          }

          if (silent) {
            setIsRefreshing(true);
          } else {
            setIsLoading(true);
          }

          try {
            const response =
              await getEarlyRecallDetail(
                earlyRecallId,
              );

            setRecord(
              response.item,
            );
          } catch (error) {
            console.error(
              'Load Early Recall detail failed:',
              error,
            );

            toast.error(
              getErrorMessage(
                error,
                'Gagal mengambil detail Early Recall.',
              ),
            );

            if (!silent) {
              navigate(
                '/early-recall',
                {
                  replace: true,
                },
              );
            }
          } finally {
            setIsLoading(false);
            setIsRefreshing(false);
          }
        },
        [
          earlyRecallId,
          navigate,
        ],
      );

    React.useEffect(() => {
      void loadRecord();
    }, [loadRecord]);

    const role =
      currentUser?.role as
        | UserRole
        | undefined;

    const isRole = (
      ...roles: UserRole[]
    ): boolean =>
      Boolean(
        role &&
          roles.includes(role),
      );

    const canEdit =
      Boolean(record) &&
      isRole(
        'HOD',
        'PM',
        'SUPER_ADMIN',
      ) &&
      [
        'DRAFT',
        'NEEDS_REVISION',
      ].includes(
        record!.status,
      );

    const canSubmit =
      canEdit;

    const canHRValidate =
      Boolean(record) &&
      isRole(
        'HR',
        'SUPER_ADMIN',
      ) &&
      record!.status ===
        'PENDING_HR_VALIDATION';

    const canPMApprove =
      Boolean(record) &&
      isRole(
        'PM',
        'SUPER_ADMIN',
      ) &&
      record!.status ===
        'PENDING_PM_APPROVAL';

    const canReturnRevision =
      Boolean(record) &&
      (
        (
          isRole('HR') &&
          record!.status ===
            'PENDING_HR_VALIDATION'
        ) ||
        (
          isRole('PM') &&
          record!.status ===
            'PENDING_PM_APPROVAL'
        ) ||
        (
          isRole(
            'SUPER_ADMIN',
          ) &&
          [
            'PENDING_HR_VALIDATION',
            'PENDING_PM_APPROVAL',
          ].includes(
            record!.status,
          )
        )
      );

    const canReject =
      canReturnRevision;

    const canStartGA =
      Boolean(record) &&
      isRole(
        'GA',
        'SUPER_ADMIN',
      ) &&
      record!.status ===
        'PM_APPROVED';

    const canMarkBooked =
      Boolean(record) &&
      isRole(
        'GA',
        'SUPER_ADMIN',
      ) &&
      [
        'PM_APPROVED',
        'GA_PROCESSING',
      ].includes(
        record!.status,
      ) &&
      record!.linked_trf
        ?.status ===
        'GA_PROCESSED';

    const canAcknowledge =
      Boolean(record) &&
      role === 'EMPLOYEE' &&
      !record!
        .employee_acknowledged_at &&
      [
        'PM_APPROVED',
        'GA_PROCESSING',
        'TRAVEL_BOOKED',
        'RETURNED_TO_SITE',
        'OS_GENERATED',
      ].includes(
        record!.status,
      );

    const canConfirmReturn =
      Boolean(record) &&
      isRole(
        'GA',
        'HR',
        'SUPER_ADMIN',
      ) &&
      record!.status ===
        'TRAVEL_BOOKED';

    const canCancel =
      Boolean(record) &&
      ![
        'RETURNED_TO_SITE',
        'OS_GENERATED',
        'REJECTED',
        'CANCELLED',
      ].includes(
        record!.status,
      ) &&
      (
        (
          role === 'HOD' &&
          [
            'DRAFT',
            'PENDING_HR_VALIDATION',
            'NEEDS_REVISION',
          ].includes(
            record!.status,
          )
        ) ||
        (
          role === 'HR' &&
          record!.status ===
            'PENDING_HR_VALIDATION'
        ) ||
        (
          role === 'PM' &&
          [
            'PENDING_PM_APPROVAL',
            'PM_APPROVED',
            'GA_PROCESSING',
            'TRAVEL_BOOKED',
          ].includes(
            record!.status,
          )
        ) ||
        role === 'SUPER_ADMIN'
      );

    const hasAnyAction =
      canEdit ||
      canSubmit ||
      canHRValidate ||
      canReturnRevision ||
      canPMApprove ||
      canStartGA ||
      canMarkBooked ||
      canAcknowledge ||
      canConfirmReturn ||
      canReject ||
      canCancel;

    const openAction = (
      action: DialogAction,
    ) => {
      setActionRemarks('');

      if (
        action ===
          'CONFIRM_RETURN' &&
        record
      ) {
        setActualReturnDate(
          record.proposed_return_date,
        );
      } else {
        setActualReturnDate('');
      }

      setActiveAction(action);
    };

    const closeDialog = () => {
      if (isProcessing) {
        return;
      }

      setActiveAction(null);
      setActionRemarks('');
      setActualReturnDate('');
    };

    const executeAction =
      async () => {
        if (
          !record ||
          !activeAction
        ) {
          return;
        }

        const config =
          DIALOG_CONFIG[
            activeAction
          ];

        if (
          config.requiresRemarks &&
          !actionRemarks.trim()
        ) {
          toast.error(
            `${config.remarksLabel ?? 'Remarks'} wajib diisi.`,
          );
          return;
        }

        if (
          config.requiresDate &&
          !actualReturnDate
        ) {
          toast.error(
            'Actual Return Date wajib diisi.',
          );
          return;
        }

        setIsProcessing(true);

        try {
          let response;

          switch (
            activeAction
          ) {
            case 'SUBMIT':
              response =
                await submitEarlyRecall(
                  record.id,
                  actionRemarks.trim() ||
                    undefined,
                );
              break;

            case 'HR_VALIDATE':
              response =
                await validateEarlyRecallByHR(
                  record.id,
                  actionRemarks.trim() ||
                    undefined,
                );
              break;

            case 'RETURN_REVISION':
              response =
                await returnEarlyRecallForRevision(
                  record.id,
                  actionRemarks.trim(),
                );
              break;

            case 'PM_APPROVE':
              response =
                await approveEarlyRecallByPM(
                  record.id,
                  actionRemarks.trim() ||
                    undefined,
                );
              break;

            case 'GA_START':
              response =
                await startEarlyRecallGAProcessing(
                  record.id,
                  actionRemarks.trim() ||
                    undefined,
                );
              break;

            case 'TRAVEL_BOOKED':
              response =
                await markEarlyRecallTravelBooked(
                  record.id,
                  actionRemarks.trim() ||
                    undefined,
                );
              break;

            case 'ACKNOWLEDGE':
              response =
                await acknowledgeEarlyRecall(
                  record.id,
                );
              break;

            case 'CONFIRM_RETURN':
              response =
                await confirmEarlyRecallActualReturn(
                  record.id,
                  actualReturnDate,
                  actionRemarks.trim() ||
                    undefined,
                );
              break;

            case 'REJECT':
              response =
                await rejectEarlyRecall(
                  record.id,
                  actionRemarks.trim(),
                );
              break;

            case 'CANCEL':
              response =
                await cancelEarlyRecall(
                  record.id,
                  actionRemarks.trim(),
                );
              break;

            default: {
              const exhaustive:
                never =
                activeAction;

              throw new Error(
                `Unsupported action: ${exhaustive}`,
              );
            }
          }

          setRecord(
            response.item,
          );

          toast.success(
            `${DIALOG_CONFIG[activeAction].confirmText} berhasil.`,
          );

          getNotificationSummary(
            response.notifications,
          );

          window.dispatchEvent(
            new CustomEvent(
              'early-recall-updated',
            ),
          );

          closeDialog();
        } catch (error) {
          console.error(
            'Early Recall action failed:',
            error,
          );

          toast.error(
            getErrorMessage(
              error,
              'Gagal memproses Early Recall.',
            ),
          );
        } finally {
          setIsProcessing(false);
        }
      };

    if (isLoading) {
      return (
        <div className="flex min-h-[420px] items-center justify-center">
          <div className="text-center">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-gray-500" />

            <p className="mt-3 text-sm text-gray-500">
              Memuat detail Early Recall...
            </p>
          </div>
        </div>
      );
    }

    if (!record) {
      return null;
    }

    const actualUsed =
      record.actual_leave_days_used ??
      record.estimated_leave_days_used;

    const actualUnused =
      record.unused_leave_days ??
      record.estimated_unused_leave_days;

    const history =
      record.history ?? [];

    const dialogConfig =
      activeAction
        ? DIALOG_CONFIG[
            activeAction
          ]
        : null;

    return (
      <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
        {/* HEADER */}
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <Button
              type="button"
              variant="ghost"
              className="-ml-3 mb-2 gap-2 text-gray-600"
              onClick={() =>
                navigate(
                  '/early-recall',
                )
              }
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Early Recall
            </Button>

            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {
                  record.recall_number
                }
              </h1>

              <EarlyRecallStatusBadge
                status={
                  record.status
                }
              />
            </div>

            <p className="mt-2 max-w-3xl text-sm text-gray-500">
              {getEarlyRecallStatusDescription(
                record.status,
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
              className="gap-2"
              onClick={() =>
                void loadRecord(true)
              }
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

            {canEdit && (
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() =>
                  navigate(
                    `/early-recall/${record.id}/edit`,
                  )
                }
              >
                <Edit className="h-4 w-4" />
                Edit
              </Button>
            )}
          </div>
        </div>

        {/* PHONE WARNING */}
        {!record.employee.phone && (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />

            <div>
              <p className="font-semibold">
                Nomor WhatsApp belum tersedia
              </p>

              <p className="mt-1">
                Workflow tetap dapat diproses, tetapi employee tidak menerima notifikasi WhatsApp sampai nomor telepon dilengkapi.
              </p>
            </div>
          </div>
        )}

        {/* SUMMARY */}
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Approved Leave
            </p>

            <p className="mt-2 text-3xl font-bold text-gray-900">
              {
                record.approved_leave_days
              }
            </p>

            <p className="text-sm text-gray-500">
              days
            </p>
          </div>

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
              Leave Used
            </p>

            <p className="mt-2 text-3xl font-bold text-blue-900">
              {actualUsed}
            </p>

            <p className="text-sm text-blue-600">
              {record.actual_return_date
                ? 'actual'
                : 'estimated'}
            </p>
          </div>

          <div className="rounded-xl border border-green-200 bg-green-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-green-600">
              Unused Leave / OS
            </p>

            <p className="mt-2 text-3xl font-bold text-green-900">
              {record.os_generated_days >
              0
                ? record.os_generated_days
                : actualUnused}
            </p>

            <p className="text-sm text-green-600">
              {record.os_ledger
                ? `Cycle ${record.os_ledger.cycle_number}`
                : 'estimated'}
            </p>
          </div>

          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-purple-600">
              Linked TRF
            </p>

            <p className="mt-2 truncate text-lg font-bold text-purple-900">
              {record.linked_trf
                ?.trf_number ??
                'Not created'}
            </p>

            <p className="text-sm text-purple-600">
              {record.linked_trf
                ?.status ??
                'Waiting PM approval'}
            </p>
          </div>
        </div>

        {/* MAIN CONTENT */}
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="space-y-5">
            {/* EMPLOYEE */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                  <UserRound className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-gray-900">
                    Employee Information
                  </h2>

                  <p className="text-sm text-gray-500">
                    Employee yang dipanggil kembali ke site.
                  </p>
                </div>
              </div>

              <dl>
                <InfoRow
                  label="Employee Name"
                  value={
                    record.employee
                      .employee_name
                  }
                />

                <InfoRow
                  label="Employee ID"
                  value={
                    record.employee
                      .employee_code
                  }
                />

                <InfoRow
                  label="Department"
                  value={
                    record.employee
                      .department
                  }
                />

                <InfoRow
                  label="Job Title"
                  value={
                    record.employee
                      .job_title
                  }
                />

                <InfoRow
                  label="WhatsApp"
                  value={
                    record.employee.phone ? (
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        {
                          record.employee.phone
                        }
                      </span>
                    ) : (
                      <span className="text-amber-600">
                        Not available
                      </span>
                    )
                  }
                />

                <InfoRow
                  label="Acknowledgment"
                  value={
                    record.employee_acknowledged_at
                      ? formatDate(
                          record.employee_acknowledged_at,
                          true,
                        )
                      : 'Not acknowledged'
                  }
                />
              </dl>
            </section>

            {/* LEAVE */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                  <CalendarDays className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-gray-900">
                    Leave &amp; Recall Calculation
                  </h2>

                  <p className="text-sm text-gray-500">
                    Perhitungan final memakai Actual Return Date.
                  </p>
                </div>
              </div>

              <dl>
                <InfoRow
                  label="Approved Leave Start"
                  value={formatDate(
                    record.approved_leave_start,
                  )}
                />

                <InfoRow
                  label="Approved Leave End"
                  value={formatDate(
                    record.approved_leave_end,
                  )}
                />

                <InfoRow
                  label="Approved Leave Days"
                  value={`${record.approved_leave_days} days`}
                />

                <InfoRow
                  label="Proposed Return Date"
                  value={formatDate(
                    record.proposed_return_date,
                  )}
                />

                <InfoRow
                  label="Estimated Leave Used"
                  value={`${record.estimated_leave_days_used} days`}
                />

                <InfoRow
                  label="Estimated Unused Leave"
                  value={`${record.estimated_unused_leave_days} days`}
                />

                <InfoRow
                  label="Actual Return Date"
                  value={
                    record.actual_return_date
                      ? formatDate(
                          record.actual_return_date,
                        )
                      : 'Not confirmed'
                  }
                />

                <InfoRow
                  label="Actual Leave Used"
                  value={
                    record.actual_leave_days_used !==
                    null &&
                    record.actual_leave_days_used !==
                      undefined
                      ? `${record.actual_leave_days_used} days`
                      : '-'
                  }
                />

                <InfoRow
                  label="Unused Leave"
                  value={
                    record.unused_leave_days !==
                    null &&
                    record.unused_leave_days !==
                      undefined
                      ? `${record.unused_leave_days} days`
                      : '-'
                  }
                />
              </dl>
            </section>

            {/* REASON */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <MessageSquareText className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-gray-900">
                    Recall Information
                  </h2>

                  <p className="text-sm text-gray-500">
                    Business reason dan catatan workflow.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    Reason
                  </p>

                  <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-900">
                    {record.reason}
                  </p>
                </div>

                {record.remarks && (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Request Remarks
                    </p>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                      {
                        record.remarks
                      }
                    </p>
                  </div>
                )}

                {record.hr_validation_remarks && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-blue-600">
                      HR Validation Remarks
                    </p>

                    <p className="mt-2 text-sm text-blue-900">
                      {
                        record.hr_validation_remarks
                      }
                    </p>
                  </div>
                )}

                {record.pm_approval_remarks && (
                  <div className="rounded-lg border border-purple-200 bg-purple-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-purple-600">
                      PM Approval Remarks
                    </p>

                    <p className="mt-2 text-sm text-purple-900">
                      {
                        record.pm_approval_remarks
                      }
                    </p>
                  </div>
                )}

                {record.ga_remarks && (
                  <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-orange-600">
                      GA Remarks
                    </p>

                    <p className="mt-2 text-sm text-orange-900">
                      {
                        record.ga_remarks
                      }
                    </p>
                  </div>
                )}

                {record.rejection_reason && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-red-600">
                      Rejection Reason
                    </p>

                    <p className="mt-2 text-sm text-red-900">
                      {
                        record.rejection_reason
                      }
                    </p>
                  </div>
                )}

                {record.cancellation_reason && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-600">
                      Cancellation Reason
                    </p>

                    <p className="mt-2 text-sm text-slate-900">
                      {
                        record.cancellation_reason
                      }
                    </p>
                  </div>
                )}
              </div>
            </section>

            {/* LINKED TRF */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                    <Plane className="h-5 w-5" />
                  </div>

                  <div>
                    <h2 className="font-semibold text-gray-900">
                      Linked Travel-In TRF
                    </h2>

                    <p className="text-sm text-gray-500">
                      Dibuat otomatis setelah PM approval.
                    </p>
                  </div>
                </div>

                {record.linked_trf && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      navigate(
                        `/trf/${record.linked_trf?.id}`,
                      )
                    }
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open TRF
                  </Button>
                )}
              </div>

              {record.linked_trf ? (
                <dl>
                  <InfoRow
                    label="TRF Number"
                    value={
                      record.linked_trf
                        .trf_number
                    }
                  />

                  <InfoRow
                    label="TRF Status"
                    value={
                      record.linked_trf
                        .status
                    }
                  />

                  <InfoRow
                    label="Travel Date"
                    value={formatDate(
                      record.linked_trf
                        .start_date,
                    )}
                  />

                  <InfoRow
                    label="Travel Type"
                    value="Travel In — Early Recall"
                  />
                </dl>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <Plane className="mx-auto h-10 w-10 text-gray-300" />

                  <p className="mt-3 text-sm font-medium text-gray-700">
                    Linked TRF belum dibuat
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    Linked Travel-In TRF otomatis dibuat saat PM menyetujui Early Recall.
                  </p>
                </div>
              )}

              {record.status ===
                'GA_PROCESSING' &&
                record.linked_trf
                  ?.status !==
                  'GA_PROCESSED' && (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                    Selesaikan linked TRF melalui menu{' '}
                    <strong>
                      Process TRFs
                    </strong>
                    . Setelah status linked TRF menjadi{' '}
                    <strong>
                      GA_PROCESSED
                    </strong>
                    , kembali ke halaman ini dan klik{' '}
                    <strong>
                      Mark Travel Booked
                    </strong>
                    .
                  </div>
                )}
            </section>

            {/* OS */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-50 text-green-600">
                  <CircleDollarSign className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-gray-900">
                    OS Ledger
                  </h2>

                  <p className="text-sm text-gray-500">
                    Early Recall dikonversi 1 unused leave day = 1 OS day.
                  </p>
                </div>
              </div>

              {record.os_ledger ? (
                <dl>
                  <InfoRow
                    label="OS Number"
                    value={
                      record.os_ledger
                        .os_number
                    }
                  />

                  <InfoRow
                    label="Original Days"
                    value={`${record.os_ledger.original_days} days`}
                  />

                  <InfoRow
                    label="Used Days"
                    value={`${record.os_ledger.used_days} days`}
                  />

                  <InfoRow
                    label="Remaining Days"
                    value={`${record.os_ledger.remaining_days} days`}
                  />

                  <InfoRow
                    label="Cycle"
                    value={`Cycle ${record.os_ledger.cycle_number}`}
                  />

                  <InfoRow
                    label="OS Status"
                    value={
                      record.os_ledger
                        .status
                    }
                  />
                </dl>
              ) : (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <FileCheck2 className="mx-auto h-10 w-10 text-gray-300" />

                  <p className="mt-3 text-sm font-medium text-gray-700">
                    OS belum dibentuk
                  </p>

                  <p className="mt-1 text-xs text-gray-500">
                    OS otomatis dibuat setelah Actual Return dikonfirmasi.
                  </p>
                </div>
              )}
            </section>

            {/* HISTORY */}
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                  <History className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-semibold text-gray-900">
                    Workflow History
                  </h2>

                  <p className="text-sm text-gray-500">
                    Audit trail setiap perubahan status dan tindakan.
                  </p>
                </div>
              </div>

              {history.length === 0 ? (
                <p className="text-sm text-gray-500">
                  History belum tersedia.
                </p>
              ) : (
                <div className="space-y-0">
                  {history.map(
                    (
                      item,
                      index,
                    ) => {
                      const toStatus =
                        getHistoryValue(
                          item,
                          'to_status',
                        ) ??
                        'UNKNOWN';

                      const fromStatus =
                        getHistoryValue(
                          item,
                          'from_status',
                        );

                      const roleValue =
                        getHistoryValue(
                          item,
                          'changed_by_role',
                        ) ??
                        getHistoryValue(
                          item,
                          'actor_type',
                        ) ??
                        'SYSTEM';

                      const remarksValue =
                        getHistoryValue(
                          item,
                          'remarks',
                        );

                      const createdAt =
                        getHistoryValue(
                          item,
                          'created_at',
                        );

                      return (
                        <div
                          key={
                            getHistoryValue(
                              item,
                              'id',
                            ) ??
                            `${toStatus}-${index}`
                          }
                          className="relative flex gap-4 pb-6 last:pb-0"
                        >
                          {index <
                            history.length -
                              1 && (
                            <div className="absolute left-[17px] top-9 h-[calc(100%-1rem)] w-px bg-gray-200" />
                          )}

                          <div className="relative z-10 mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-gray-200 bg-white">
                            <Clock3 className="h-4 w-4 text-gray-500" />
                          </div>

                          <div className="min-w-0 flex-1 rounded-lg border border-gray-100 bg-gray-50 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="font-semibold text-gray-900">
                                  {fromStatus
                                    ? `${fromStatus} → ${toStatus}`
                                    : toStatus}
                                </p>

                                <p className="mt-1 text-xs text-gray-500">
                                  Actor: {
                                    roleValue
                                  }
                                </p>
                              </div>

                              <p className="text-xs text-gray-400">
                                {formatDate(
                                  createdAt,
                                  true,
                                )}
                              </p>
                            </div>

                            {remarksValue && (
                              <p className="mt-3 whitespace-pre-wrap text-sm text-gray-700">
                                {
                                  remarksValue
                                }
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </section>
          </div>

          {/* ACTION PANEL */}
          <aside className="space-y-5">
            <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm xl:sticky xl:top-20">
              <div className="mb-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-blue-600" />

                <div>
                  <h2 className="font-semibold text-gray-900">
                    Available Actions
                  </h2>

                  <p className="text-xs text-gray-500">
                    Role: {role ?? '-'}
                  </p>
                </div>
              </div>

              {!hasAnyAction ? (
                <div className="rounded-lg bg-gray-50 p-4 text-sm text-gray-500">
                  Tidak ada tindakan yang diperlukan dari role Anda pada status ini.
                </div>
              ) : (
                <div className="space-y-2">
                  {canEdit && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2"
                      onClick={() =>
                        navigate(
                          `/early-recall/${record.id}/edit`,
                        )
                      }
                    >
                      <Edit className="h-4 w-4" />
                      Edit Request
                    </Button>
                  )}

                  {canSubmit && (
                    <Button
                      type="button"
                      className="w-full justify-start gap-2"
                      onClick={() =>
                        openAction(
                          'SUBMIT',
                        )
                      }
                    >
                      <Send className="h-4 w-4" />
                      Submit to HR
                    </Button>
                  )}

                  {canHRValidate && (
                    <Button
                      type="button"
                      className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700"
                      onClick={() =>
                        openAction(
                          'HR_VALIDATE',
                        )
                      }
                    >
                      <UserCheck className="h-4 w-4" />
                      Validate &amp; Forward
                    </Button>
                  )}

                  {canPMApprove && (
                    <Button
                      type="button"
                      className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700"
                      onClick={() =>
                        openAction(
                          'PM_APPROVE',
                        )
                      }
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Approve Early Recall
                    </Button>
                  )}

                  {canStartGA && (
                    <Button
                      type="button"
                      className="w-full justify-start gap-2 bg-orange-600 hover:bg-orange-700"
                      onClick={() =>
                        openAction(
                          'GA_START',
                        )
                      }
                    >
                      <Plane className="h-4 w-4" />
                      Start GA Processing
                    </Button>
                  )}

                  {canMarkBooked && (
                    <Button
                      type="button"
                      className="w-full justify-start gap-2 bg-sky-600 hover:bg-sky-700"
                      onClick={() =>
                        openAction(
                          'TRAVEL_BOOKED',
                        )
                      }
                    >
                      <FileCheck2 className="h-4 w-4" />
                      Mark Travel Booked
                    </Button>
                  )}

                  {canAcknowledge && (
                    <Button
                      type="button"
                      className="w-full justify-start gap-2 bg-blue-600 hover:bg-blue-700"
                      onClick={() =>
                        openAction(
                          'ACKNOWLEDGE',
                        )
                      }
                    >
                      <BellRing className="h-4 w-4" />
                      Saya Sudah Mengetahui
                    </Button>
                  )}

                  {canConfirmReturn && (
                    <Button
                      type="button"
                      className="w-full justify-start gap-2 bg-green-600 hover:bg-green-700"
                      onClick={() =>
                        openAction(
                          'CONFIRM_RETURN',
                        )
                      }
                    >
                      <MapPin className="h-4 w-4" />
                      Confirm Actual Return
                    </Button>
                  )}

                  {canReturnRevision && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
                      onClick={() =>
                        openAction(
                          'RETURN_REVISION',
                        )
                      }
                    >
                      <RotateCcw className="h-4 w-4" />
                      Return for Revision
                    </Button>
                  )}

                  {canReject && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 border-red-300 text-red-700 hover:bg-red-50"
                      onClick={() =>
                        openAction(
                          'REJECT',
                        )
                      }
                    >
                      <XCircle className="h-4 w-4" />
                      Reject
                    </Button>
                  )}

                  {canCancel && (
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start gap-2 border-slate-300 text-slate-700 hover:bg-slate-50"
                      onClick={() =>
                        openAction(
                          'CANCEL',
                        )
                      }
                    >
                      <Undo2 className="h-4 w-4" />
                      Cancel Early Recall
                    </Button>
                  )}
                </div>
              )}

              <div className="mt-5 border-t border-gray-100 pt-4">
                <p className="text-xs text-gray-400">
                  Created{' '}
                  {formatDate(
                    record.created_at,
                    true,
                  )}
                </p>

                <p className="mt-1 text-xs text-gray-400">
                  Last updated{' '}
                  {formatDate(
                    record.updated_at,
                    true,
                  )}
                </p>
              </div>
            </section>
          </aside>
        </div>

        {/* ACTION DIALOG */}
        <Dialog
          open={Boolean(
            activeAction,
          )}
          onOpenChange={(open) => {
            if (!open) {
              closeDialog();
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                {
                  dialogConfig?.title
                }
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <p className="text-sm leading-6 text-gray-600">
                {
                  dialogConfig?.description
                }
              </p>

              {dialogConfig?.requiresDate && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    Actual Return Date
                    <span className="text-red-500">
                      {' '}
                      *
                    </span>
                  </label>

                  <Input
                    type="date"
                    value={
                      actualReturnDate
                    }
                    min={
                      record.approved_leave_start
                    }
                    max={
                      record.approved_leave_end
                    }
                    disabled={
                      isProcessing
                    }
                    onChange={(event) =>
                      setActualReturnDate(
                        event.target.value,
                      )
                    }
                  />
                </div>
              )}

              {(dialogConfig?.remarksLabel ||
                dialogConfig?.requiresRemarks) && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-gray-700">
                    {
                      dialogConfig?.remarksLabel ??
                      'Remarks'
                    }

                    {dialogConfig?.requiresRemarks && (
                      <span className="text-red-500">
                        {' '}
                        *
                      </span>
                    )}
                  </label>

                  <Textarea
                    value={
                      actionRemarks
                    }
                    disabled={
                      isProcessing
                    }
                    rows={4}
                    placeholder={
                      dialogConfig?.remarksPlaceholder
                    }
                    onChange={(event) =>
                      setActionRemarks(
                        event.target.value,
                      )
                    }
                  />
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={
                  isProcessing
                }
                onClick={
                  closeDialog
                }
              >
                Close
              </Button>

              <Button
                type="button"
                disabled={
                  isProcessing
                }
                className={
                  dialogConfig?.confirmClassName
                }
                onClick={() =>
                  void executeAction()
                }
              >
                {isProcessing && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}

                {
                  dialogConfig?.confirmText
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  };

export default EarlyRecallDetailPage;