import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/common/StatusBadge';
import { useAuthStore } from '@/store';
import type { TRF } from '@/types';
import {
  User,
  Target,
  Hotel,
  Plane,
  Calendar,
  ArrowLeft,
  Edit,
  Clock,
  CheckCircle,
  MapPin,
  Briefcase,
  Building,
  Phone,
  Mail,
  Shield,
  Ticket,
  Car,
  FileText,
  MessageSquare,
  Download,
  Trash2,
} from 'lucide-react';
import { getPurposeLabel } from '@/constants/travelPurposeOptions';
import { cn } from '@/lib/utils';

// import ExportTRFButton from '@/components/common/ExportTRFButton';

// Parse travelPurpose:
// - format lama: "TRAINING"
// - format baru: '["FIELD_BREAK","TRAINING"]'
const parsePurposes = (
  raw: string | string[] | undefined,
): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter(Boolean);

  try {
    const parsed = JSON.parse(raw);

    return Array.isArray(parsed)
      ? parsed.filter(Boolean)
      : [raw];
  } catch {
    return [raw];
  }
};

// ==========================================
// Komponen dipindahkan ke luar komponen utama
// agar tidak dibuat ulang pada setiap render.
// ==========================================

const InfoRow = ({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value?: string;
}) => (
  <div className="flex items-start gap-3">
    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100">
      <Icon className="h-4 w-4 text-gray-500" />
    </div>

    <div className="flex-1">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm font-medium text-gray-900">
        {value || '-'}
      </p>
    </div>
  </div>
);

const SectionCard = ({
  title,
  icon: Icon,
  iconBg,
  iconColor,
  children,
}: {
  title: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
  children: React.ReactNode;
}) => (
  <Card className="border shadow-sm">
    <CardHeader className="pb-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-lg',
            iconBg,
          )}
        >
          <Icon className={cn('h-5 w-5', iconColor)} />
        </div>

        <CardTitle className="text-lg">{title}</CardTitle>
      </div>
    </CardHeader>

    <CardContent>{children}</CardContent>
  </Card>
);

interface TRFDetailViewProps {
  trf: TRF;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TRFDetailView: React.FC<TRFDetailViewProps> = ({
  trf,
  onEdit,
  onDelete,
}) => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const canEdit =
    trf.status === 'DRAFT' ||
    trf.status === 'NEEDS_REVISION' ||
    (currentUser?.role === 'HR' &&
      trf.status === 'HOD_APPROVED') ||
    (currentUser?.role === 'GA' &&
      trf.status === 'PM_APPROVED');

  const canDelete = trf.status === 'DRAFT';
  const isEmployee = currentUser?.role === 'EMPLOYEE';

  const canSeeVoucher =
    trf.status === 'GA_PROCESSED' ||
    Boolean(trf.gaProcess?.processed && isEmployee);

  /*
   * Normalisasi purposeEntries.
   * Data lama tetap menggunakan field travelPurpose/startDate/endDate.
   */
  const purposeEntries = (
    Array.isArray((trf as any).purposeEntries) &&
    (trf as any).purposeEntries.length > 0
      ? (trf as any).purposeEntries
      : [
          {
            id: 'legacy',
            travelPurpose: trf.travelPurpose ?? '',
            startDate: trf.startDate ?? '',
            endDate: trf.endDate ?? '',
            purposeRemarks: trf.purposeRemarks ?? '',
          },
        ]
  ) as Array<{
    id?: string;
    travelPurpose: string;
    startDate: string;
    endDate: string;
    purposeRemarks?: string;
  }>;

  /*
   * Normalisasi accommodations.
   * Data lama tetap menggunakan field accommodation.
   */
  const accommodationEntries = (
    Array.isArray((trf as any).accommodations) &&
    (trf as any).accommodations.length > 0
      ? (trf as any).accommodations
      : trf.accommodation
        ? [trf.accommodation]
        : []
  ) as Array<{
    hotelName?: string;
    checkInDate?: string;
    checkOutDate?: string;
    remarks?: string;
  }>;

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';

    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';

    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (durationMs: number) => {
    const totalMinutes = Math.floor(durationMs / 60_000);

    if (totalMinutes < 1) {
      return 'Less than 1 minute';
    }

    const days = Math.floor(totalMinutes / 1_440);
    const hours = Math.floor(
      (totalMinutes % 1_440) / 60,
    );
    const minutes = totalMinutes % 60;

    const parts: string[] = [];

    if (days > 0) {
      parts.push(`${days} day${days > 1 ? 's' : ''}`);
    }

    if (hours > 0) {
      parts.push(`${hours} hour${hours > 1 ? 's' : ''}`);
    }

    if (minutes > 0) {
      parts.push(
        `${minutes} minute${minutes > 1 ? 's' : ''}`,
      );
    }

    return parts.join(' ');
  };

  const getDurationMs = (
    startDate?: string,
    endDate?: string,
  ) => {
    if (!startDate || !endDate) return null;

    const startTime = new Date(startDate).getTime();
    const endTime = new Date(endDate).getTime();

    if (
      Number.isNaN(startTime) ||
      Number.isNaN(endTime) ||
      endTime < startTime
    ) {
      return null;
    }

    return endTime - startTime;
  };

  const getDurationPerformance = (
    durationMs: number,
    sla: {
      fastHours: number;
      normalHours: number;
    },
  ) => {
    const durationHours = durationMs / 3_600_000;

    if (durationHours <= sla.fastHours) {
      return {
        label: 'Fast',
        className:
          'border-emerald-200 bg-emerald-50 text-emerald-700',
      };
    }

    if (durationHours <= sla.normalHours) {
      return {
        label: 'Normal',
        className:
          'border-blue-200 bg-blue-50 text-blue-700',
      };
    }

    return {
      label: 'Needs Attention',
      className:
        'border-amber-200 bg-amber-50 text-amber-700',
    };
  };

  const renderApprovalTimeline = () => {
    type TimelineStep = {
      label: string;
      date?: string;
      done: boolean;
      icon: React.ElementType;
      by?: string;
      remarks?: string;
      sla?: {
        fastHours: number;
        normalHours: number;
      };
    };

    /*
     * Untuk data lama yang belum memiliki submitted_at,
     * createdAt digunakan sebagai fallback.
     */
    const submittedDate =
      trf.status === 'DRAFT'
        ? undefined
        : trf.submittedAt ?? trf.createdAt;

    const steps: TimelineStep[] = [
      {
        label: 'Submitted',
        date: submittedDate,
        done: Boolean(submittedDate),
        icon: Clock,
      },
      {
        label: 'Admin Dept Verified',
        date: trf.adminDeptVerify?.verifiedAt,
        done: Boolean(trf.adminDeptVerify?.verifiedAt),
        icon: CheckCircle,
        by: trf.adminDeptVerify?.verifierName,
        remarks: trf.adminDeptVerify?.remarks,
        // Fast ≤ 4 jam, Normal ≤ 8 jam
        sla: {
          fastHours: 4,
          normalHours: 8,
        },
      },
      {
        label: 'HoD Approved',
        date: trf.parallelApproval?.hod?.actionAt,
        done: Boolean(
          trf.parallelApproval?.hod?.actionAt,
        ),
        icon: Briefcase,
        by: trf.parallelApproval?.hod?.actionByName,
        remarks: trf.parallelApproval?.hod?.remarks,
        // Fast ≤ 8 jam, Normal ≤ 24 jam
        sla: {
          fastHours: 8,
          normalHours: 24,
        },
      },
      {
        label: 'HR Approved',
        date: trf.parallelApproval?.hr?.actionAt,
        done: Boolean(
          trf.parallelApproval?.hr?.actionAt,
        ),
        icon: User,
        by: trf.parallelApproval?.hr?.actionByName,
        remarks: trf.parallelApproval?.hr?.remarks,
        // Fast ≤ 8 jam, Normal ≤ 24 jam
        sla: {
          fastHours: 8,
          normalHours: 24,
        },
      },
      {
        label: 'PM Approved',
        date: trf.pmApproval?.approvedAt,
        done: Boolean(trf.pmApproval?.approvedAt),
        icon: Shield,
        by: trf.pmApproval?.approverName,
        remarks: trf.pmApproval?.remarks,
        // Fast ≤ 12 jam, Normal ≤ 48 jam
        sla: {
          fastHours: 12,
          normalHours: 48,
        },
      },
      {
        label: 'GA Processed',
        date: trf.gaProcess?.processedAt,
        done: Boolean(trf.gaProcess?.processedAt),
        icon: Plane,
        by: trf.gaProcess?.processorName,
        // Fast ≤ 24 jam, Normal ≤ 48 jam
        sla: {
          fastHours: 24,
          normalHours: 48,
        },
      },
    ];

    const stepsWithMetrics = steps.map(
      (step, index) => {
        const previousStep =
          index > 0 ? steps[index - 1] : undefined;

        return {
          ...step,
          previousLabel: previousStep?.label,
          durationMs: previousStep
            ? getDurationMs(
                previousStep.date,
                step.date,
              )
            : null,
        };
      },
    );

    const completedSteps = stepsWithMetrics.filter(
      (step) => Boolean(step.date),
    );

    const firstCompletedStep = completedSteps[0];

    const lastCompletedStep =
      completedSteps[completedSteps.length - 1];

    const totalDurationMs = getDurationMs(
      firstCompletedStep?.date,
      lastCompletedStep?.date,
    );

    const measuredStages = stepsWithMetrics.filter(
      (step) => step.durationMs !== null,
    );

    const measuredTotalMs = measuredStages.reduce(
      (total, step) =>
        total + (step.durationMs ?? 0),
      0,
    );

    const averageDurationMs =
      measuredStages.length > 0
        ? measuredTotalMs / measuredStages.length
        : null;

    const slowestStage = measuredStages.reduce<
      (typeof stepsWithMetrics)[number] | null
    >((slowest, step) => {
      if (!slowest) return step;

      return (step.durationMs ?? 0) >
        (slowest.durationMs ?? 0)
        ? step
        : slowest;
    }, null);

    const processCompleted =
      trf.status === 'GA_PROCESSED';

    return (
      <div className="space-y-5">
        <h3 className="font-semibold text-gray-900">
          Approval Timeline
        </h3>

        <div className="relative">
          {stepsWithMetrics.map((step, index) => {
            const performance =
              step.durationMs !== null && step.sla
                ? getDurationPerformance(
                    step.durationMs,
                    step.sla,
                  )
                : null;

            return (
              <div
                key={step.label}
                className="flex gap-4 pb-5 last:pb-0"
              >
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-300',
                      step.done
                        ? 'bg-green-100 text-green-600'
                        : 'bg-gray-100 text-gray-400',
                    )}
                  >
                    <step.icon className="h-4 w-4" />
                  </div>

                  {index <
                    stepsWithMetrics.length - 1 && (
                    <div
                      className={cn(
                        'my-1 w-0.5 flex-1 transition-colors duration-300',
                        step.done
                          ? 'bg-green-300'
                          : 'bg-gray-200',
                      )}
                    />
                  )}
                </div>

                <div className="min-w-0 flex-1 pb-3">
                  <p
                    className={cn(
                      'font-medium',
                      step.done
                        ? 'text-gray-900'
                        : 'text-gray-500',
                    )}
                  >
                    {step.label}
                  </p>

                  {step.done && step.date && (
                    <p className="text-sm text-gray-500">
                      {formatDateTime(step.date)}
                    </p>
                  )}

                  {step.done && step.by && (
                    <p className="text-sm text-gray-600">
                      by {step.by}
                    </p>
                  )}

                  {step.done && step.remarks && (
                    <p className="mt-1 text-sm italic text-gray-500">
                      &quot;{step.remarks}&quot;
                    </p>
                  )}

                  {step.durationMs !== null &&
                    step.previousLabel &&
                    performance && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs">
                        <span className="text-gray-500">
                          {step.previousLabel} →{' '}
                          {step.label}
                        </span>

                        <span className="font-semibold text-gray-900">
                          {formatDuration(
                            step.durationMs,
                          )}
                        </span>

                        <Badge
                          variant="outline"
                          className={
                            performance.className
                          }
                        >
                          {performance.label}
                        </Badge>
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>

        {totalDurationMs !== null &&
          completedSteps.length > 1 && (
            <div className="rounded-lg border border-gray-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">
                  {processCompleted
                    ? 'Total process duration:'
                    : 'Current process duration:'}
                </span>

                <span className="text-sm font-bold text-blue-600">
                  {formatDuration(totalDurationMs)}
                </span>
              </div>

              <div className="mt-3 grid gap-2 text-sm md:grid-cols-3">
                <div>
                  <span className="text-gray-500">
                    Status:{' '}
                  </span>

                  <span className="font-medium text-gray-800">
                    {processCompleted
                      ? 'Completed'
                      : 'In Progress'}
                  </span>
                </div>

                {slowestStage?.durationMs !==
                  null &&
                  slowestStage?.previousLabel && (
                    <div>
                      <span className="text-gray-500">
                        Slowest stage:{' '}
                      </span>

                      <span className="font-medium text-gray-800">
                        {slowestStage.previousLabel} →{' '}
                        {slowestStage.label}
                      </span>

                      <span className="ml-1 text-gray-600">
                        (
                        {formatDuration(
                          slowestStage.durationMs ?? 0,
                        )}
                        )
                      </span>
                    </div>
                  )}

                {averageDurationMs !== null && (
                  <div>
                    <span className="text-gray-500">
                      Average per stage:{' '}
                    </span>

                    <span className="font-medium text-gray-800">
                      {formatDuration(
                        averageDurationMs,
                      )}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
    );
  };

  const rawDocs = trf.gaDocuments || {};

  const filesList = Object.values(rawDocs).filter(
    (
      val,
    ): val is {
      name: string;
      url: string;
    } =>
      typeof val === 'object' &&
      val !== null &&
      'url' in val,
  );

  const legacyTrf = trf as unknown as Record<
    string,
    string | undefined
  >;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Button
            variant="ghost"
            size="sm"
            className="mb-4 -ml-2 text-gray-500"
            onClick={() => navigate('/trf')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to List
          </Button>

          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {trf.trfNumber}
            </h1>

            <StatusBadge status={trf.status} />
          </div>

          <p className="mt-1 text-gray-500">
            Created on {formatDateTime(trf.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* <ExportTRFButton trf={trf} /> */}

          {canEdit && onEdit && (
            <Button
              variant="outline"
              onClick={onEdit}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}

          {canDelete && onDelete && (
            <Button
              variant="destructive"
              onClick={onDelete}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Approval Timeline */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          {renderApprovalTimeline()}
        </CardContent>
      </Card>

      {/* Employee Information */}
      <SectionCard
        title="Employee Information"
        icon={User}
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
      >
        {trf.employee && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 border-b border-gray-100 pb-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <span className="text-2xl font-semibold text-blue-700">
                  {trf.employee.employeeName.charAt(0)}
                </span>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  {trf.employee.employeeName}
                </h3>

                <p className="text-gray-500">
                  {trf.employee.jobTitle}
                </p>

                <Badge
                  variant="secondary"
                  className="mt-1"
                >
                  {trf.employee.employeeType}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <InfoRow
                icon={Building}
                label="Department"
                value={trf.employee.department || '-'}
              />

              <InfoRow
                icon={Briefcase}
                label="Tenant"
                value={trf.employee.tenant || '-'}
              />

              <InfoRow
                icon={MapPin}
                label="Section"
                value={trf.employee.section || '-'}
              />

              <InfoRow
                icon={MapPin}
                label="Point of Hire"
                value={trf.employee.pointOfHire || '-'}
              />

              <InfoRow
                icon={Mail}
                label="Email"
                value={trf.employee.email || '-'}
              />

              <InfoRow
                icon={Phone}
                label="Phone"
                value={trf.employee.phone || '-'}
              />

              <InfoRow
                icon={Calendar}
                label="Date of Hire"
                value={formatDate(
                  trf.employee.dateOfHire,
                )}
              />

              <InfoRow
                icon={Shield}
                label="MCU Status"
                value={
                  (
                    trf.employee as unknown as Record<
                      string,
                      string
                    >
                  )?.mcuStatus || '-'
                }
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Travel Purpose */}
      <SectionCard
        title="Travel Purpose"
        icon={Target}
        iconBg="bg-green-50"
        iconColor="text-green-600"
      >
        <div className="space-y-4">
          {purposeEntries.map((purpose, index) => (
            <div
              key={purpose.id ?? index}
              className={`rounded-lg border p-4 ${
                purposeEntries.length > 1
                  ? 'border-green-200 bg-green-50/30'
                  : 'border-gray-100'
              }`}
            >
              {purposeEntries.length > 1 && (
                <p className="mb-3 text-xs font-semibold text-green-700">
                  Travel Purpose #{index + 1}
                </p>
              )}

              <div>
                <p className="text-xs text-gray-500">
                  Purpose
                </p>

                <div className="mt-1 flex flex-wrap gap-1.5">
                  {parsePurposes(
                    purpose.travelPurpose,
                  ).length > 0 ? (
                    parsePurposes(
                      purpose.travelPurpose,
                    ).map((key) => (
                      <span
                        key={key}
                        className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-medium text-green-800"
                      >
                        {getPurposeLabel(key)}
                      </span>
                    ))
                  ) : (
                    <p className="text-lg font-medium text-gray-900">
                      -
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs text-gray-500">
                    Start Date
                  </p>

                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(purpose.startDate)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-500">
                    End Date
                  </p>

                  <p className="text-sm font-medium text-gray-900">
                    {formatDate(purpose.endDate)}
                  </p>
                </div>
              </div>

              {purpose.purposeRemarks && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500">
                    Remarks
                  </p>

                  <p className="mt-0.5 text-sm text-gray-700">
                    {purpose.purposeRemarks}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Accommodation */}
      <SectionCard
        title="Accommodation"
        icon={Hotel}
        iconBg="bg-indigo-50"
        iconColor="text-indigo-600"
      >
        <div className="space-y-4">
          {accommodationEntries.length === 0 ? (
            <p className="text-sm italic text-gray-500">
              No accommodation arranged.
            </p>
          ) : (
            accommodationEntries.map(
              (accommodation, index) => (
                <div
                  key={index}
                  className={`rounded-lg border p-4 ${
                    accommodationEntries.length > 1
                      ? 'border-indigo-200 bg-indigo-50/20'
                      : 'border-gray-100'
                  }`}
                >
                  {accommodationEntries.length >
                    1 && (
                    <p className="mb-3 text-xs font-semibold text-indigo-700">
                      Accommodation #{index + 1}
                    </p>
                  )}

                  <div>
                    <p className="text-xs text-gray-500">
                      Hotel
                    </p>

                    <p className="text-lg font-medium text-gray-900">
                      {accommodation.hotelName ?? '-'}
                    </p>
                  </div>

                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-gray-500">
                        Check-in Date
                      </p>

                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(
                          accommodation.checkInDate,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Check-out Date
                      </p>

                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(
                          accommodation.checkOutDate,
                        )}
                      </p>
                    </div>
                  </div>

                  {accommodation.remarks && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">
                        Remarks
                      </p>

                      <p className="mt-0.5 text-sm text-gray-700">
                        {accommodation.remarks}
                      </p>
                    </div>
                  )}
                </div>
              ),
            )
          )}
        </div>
      </SectionCard>

      {/* Travel Arrangements */}
      {trf.travelArrangements.length > 0 && (
        <SectionCard
          title="Travel Arrangements"
          icon={Plane}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        >
          <div className="space-y-4">
            {trf.travelArrangements.map(
              (arrangement, index) => (
                <div
                  key={arrangement.id || index}
                  className={cn(
                    'rounded-lg border p-4',
                    arrangement.travelType ===
                      'TRAVEL_IN'
                      ? 'border-blue-200 bg-blue-50/30'
                      : 'border-green-200 bg-green-50/30',
                  )}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={cn(
                        arrangement.travelType ===
                          'TRAVEL_IN'
                          ? 'border-blue-300 text-blue-700'
                          : 'border-green-300 text-green-700',
                      )}
                    >
                      {arrangement.travelType ===
                      'TRAVEL_IN'
                        ? 'Travel In'
                        : 'Travel Out'}
                    </Badge>

                    <span className="text-sm capitalize text-gray-500">
                      {arrangement.arrangementType.replace(
                        '_',
                        ' ',
                      )}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div>
                      <p className="text-xs text-gray-500">
                        Transportation
                      </p>

                      <p className="text-sm font-medium capitalize text-gray-900">
                        {arrangement.transportation.replace(
                          '_',
                          ' ',
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        Travel Date
                      </p>

                      <p className="text-sm font-medium text-gray-900">
                        {formatDate(
                          arrangement.travelDate,
                        )}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        From
                      </p>

                      <p className="text-sm font-medium text-gray-900">
                        {arrangement.fromLocation}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs text-gray-500">
                        To
                      </p>

                      <p className="text-sm font-medium text-gray-900">
                        {arrangement.toLocation}
                      </p>
                    </div>
                  </div>

                  {arrangement.specialArrangement && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-medium text-amber-700">
                        Special Arrangement
                      </p>

                      <p className="mt-1 text-sm text-amber-800">
                        {arrangement.justification}
                      </p>
                    </div>
                  )}

                  {arrangement.remarks && (
                    <div className="mt-3">
                      <p className="text-xs text-gray-500">
                        Remarks
                      </p>

                      <p className="text-sm text-gray-700">
                        {arrangement.remarks}
                      </p>
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </SectionCard>
      )}

      {/* Voucher Section */}
      {canSeeVoucher && trf.gaProcess && (
        <SectionCard
          title="Travel Voucher & Tickets"
          icon={Ticket}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        >
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />

                <span className="font-semibold text-green-900">
                  Processed by GA
                </span>
              </div>

              <p className="text-sm text-green-700">
                {formatDateTime(
                  trf.gaProcess.processedAt,
                )}{' '}
                by {trf.gaProcess.processorName}
              </p>
            </div>

            {trf.gaProcess.voucherDetails
              ?.hotelVoucher && (
              <div className="rounded-lg bg-blue-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Hotel className="h-5 w-5 text-blue-600" />

                  <span className="font-medium text-blue-900">
                    Hotel Voucher
                  </span>
                </div>

                <p className="text-sm text-blue-800">
                  {
                    trf.gaProcess.voucherDetails
                      .hotelVoucher
                  }
                </p>
              </div>
            )}

            {trf.gaProcess.voucherDetails
              ?.flightTicket && (
              <div className="rounded-lg bg-indigo-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Plane className="h-5 w-5 text-indigo-600" />

                  <span className="font-medium text-indigo-900">
                    Flight Ticket
                  </span>
                </div>

                <p className="text-sm text-indigo-800">
                  {
                    trf.gaProcess.voucherDetails
                      .flightTicket
                  }
                </p>
              </div>
            )}

            {trf.gaProcess.voucherDetails
              ?.transportation && (
              <div className="rounded-lg bg-orange-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Car className="h-5 w-5 text-orange-600" />

                  <span className="font-medium text-orange-900">
                    Ground Transportation
                  </span>
                </div>

                <p className="text-sm text-orange-800">
                  {
                    trf.gaProcess.voucherDetails
                      .transportation
                  }
                </p>
              </div>
            )}

            {trf.gaProcess.voucherDetails?.other && (
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <FileText className="h-5 w-5 text-gray-600" />

                  <span className="font-medium text-gray-900">
                    Other Details
                  </span>
                </div>

                <p className="text-sm text-gray-700">
                  {trf.gaProcess.voucherDetails.other}
                </p>
              </div>
            )}

            {filesList.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-gray-100 pt-4">
                <p className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <Download className="h-4 w-4" />
                  Attachments (E-Tickets / Vouchers)
                </p>

                <div className="flex flex-col gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3">
                  {filesList.map((file, index) => (
                    <a
                      key={file.url || index}
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-2 rounded-md border bg-white p-2.5 text-sm text-blue-600 shadow-sm transition-colors hover:bg-blue-50 hover:text-blue-800"
                    >
                      <FileText className="h-4 w-4 text-blue-500" />
                      Download {file.name}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {trf.gaProcess.remarksToEmployee && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-amber-600" />

                  <span className="font-medium text-amber-900">
                    Message from GA
                  </span>
                </div>

                <p className="text-sm italic text-amber-800">
                  &quot;
                  {trf.gaProcess.remarksToEmployee}
                  &quot;
                </p>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {legacyTrf.approverName &&
        !trf.pmApproval && (
          <Card className="border bg-gray-50 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600" />

                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {trf.status === 'PM_APPROVED'
                      ? 'Approved by'
                      : 'Processed by'}
                    : {legacyTrf.approverName}
                  </p>

                  <p className="text-xs text-gray-500">
                    {formatDateTime(
                      legacyTrf.approvedAt,
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
    </div>
  );
};

export default TRFDetailView;