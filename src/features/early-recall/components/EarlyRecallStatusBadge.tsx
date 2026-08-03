import React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  EarlyRecallStatus,
} from '@/lib/earlyRecallApi';

interface StatusConfig {
  label: string;
  description: string;
  className: string;
}

const STATUS_CONFIG: Record<
  EarlyRecallStatus,
  StatusConfig
> = {
  DRAFT: {
    label: 'Draft',
    description:
      'Permintaan masih disimpan dan belum dikirim ke HR.',
    className:
      'border-gray-200 bg-gray-100 text-gray-700',
  },

  PENDING_HR_VALIDATION: {
    label: 'Pending HR Validation',
    description:
      'Menunggu HR memvalidasi periode cuti dan estimasi sisa cuti.',
    className:
      'border-blue-200 bg-blue-50 text-blue-700',
  },

  NEEDS_REVISION: {
    label: 'Needs Revision',
    description:
      'Permintaan harus diperbaiki sebelum diajukan kembali.',
    className:
      'border-amber-200 bg-amber-50 text-amber-700',
  },

  HR_VALIDATED: {
    label: 'HR Validated',
    description:
      'Periode cuti telah divalidasi HR.',
    className:
      'border-cyan-200 bg-cyan-50 text-cyan-700',
  },

  PENDING_PM_APPROVAL: {
    label: 'Pending PM Approval',
    description:
      'Menunggu persetujuan Project Manager.',
    className:
      'border-purple-200 bg-purple-50 text-purple-700',
  },

  PM_APPROVED: {
    label: 'PM Approved',
    description:
      'Recall telah disetujui dan linked Travel-In TRF sudah dibuat.',
    className:
      'border-indigo-200 bg-indigo-50 text-indigo-700',
  },

  GA_PROCESSING: {
    label: 'GA Processing',
    description:
      'GA sedang memproses tiket dan pengaturan perjalanan.',
    className:
      'border-orange-200 bg-orange-50 text-orange-700',
  },

  TRAVEL_BOOKED: {
    label: 'Travel Booked',
    description:
      'Perjalanan kembali ke site sudah diatur.',
    className:
      'border-sky-200 bg-sky-50 text-sky-700',
  },

  RETURNED_TO_SITE: {
    label: 'Returned to Site',
    description:
      'Actual return sudah dikonfirmasi dan menunggu finalisasi OS.',
    className:
      'border-teal-200 bg-teal-50 text-teal-700',
  },

  OS_GENERATED: {
    label: 'OS Generated',
    description:
      'Sisa cuti telah dikonversi menjadi OS Cycle 0.',
    className:
      'border-green-200 bg-green-50 text-green-700',
  },

  REJECTED: {
    label: 'Rejected',
    description:
      'Permintaan Early Recall ditolak.',
    className:
      'border-red-200 bg-red-50 text-red-700',
  },

  CANCELLED: {
    label: 'Cancelled',
    description:
      'Permintaan Early Recall dibatalkan.',
    className:
      'border-slate-200 bg-slate-100 text-slate-700',
  },
};

export const getEarlyRecallStatusLabel = (
  status: EarlyRecallStatus,
): string =>
  STATUS_CONFIG[status]?.label ??
  status;

export const getEarlyRecallStatusDescription = (
  status: EarlyRecallStatus,
): string =>
  STATUS_CONFIG[status]?.description ??
  status;

export const isEarlyRecallTerminalStatus = (
  status: EarlyRecallStatus,
): boolean =>
  [
    'OS_GENERATED',
    'REJECTED',
    'CANCELLED',
  ].includes(status);

interface EarlyRecallStatusBadgeProps {
  status: EarlyRecallStatus;
  className?: string;
}

const EarlyRecallStatusBadge: React.FC<
  EarlyRecallStatusBadgeProps
> = ({
  status,
  className,
}) => {
  const config =
    STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap font-medium',
        config?.className,
        className,
      )}
      title={
        config?.description ??
        status
      }
    >
      {config?.label ?? status}
    </Badge>
  );
};

export default EarlyRecallStatusBadge;
