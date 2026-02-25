import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { TRFStatus } from '@/types';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: TRFStatus;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const statusConfig: Record<string, { 
  label: string; 
  bgColor: string;
  textColor: string;
  borderColor: string;
}> = {
  // Status Baru
  DRAFT: {
    label: 'Draft',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300'
  },
  SUBMITTED: {
    label: 'Submitted',
    bgColor: 'bg-blue-100',
    textColor: 'text-blue-700',
    borderColor: 'border-blue-300'
  },
  PENDING_APPROVAL: {
    label: 'Pending Approval',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300'
  },
  HOD_APPROVED: {
    label: 'HoD Approved',
    bgColor: 'bg-indigo-100',
    textColor: 'text-indigo-700',
    borderColor: 'border-indigo-300'
  },
  HR_APPROVED: {
    label: 'HR Approved',
    bgColor: 'bg-pink-100',
    textColor: 'text-pink-700',
    borderColor: 'border-pink-300'
  },
  PARALLEL_APPROVED: {
    label: 'Parallel Approved',
    bgColor: 'bg-cyan-100',
    textColor: 'text-cyan-700',
    borderColor: 'border-cyan-300'
  },
  PM_APPROVED: {
    label: 'PM Approved',
    bgColor: 'bg-teal-100',
    textColor: 'text-teal-700',
    borderColor: 'border-teal-300'
  },
  GA_PROCESSED: {
    label: 'GA Processed',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300'
  },
  REJECTED: {
    label: 'Rejected',
    bgColor: 'bg-red-100',
    textColor: 'text-red-700',
    borderColor: 'border-red-300'
  },
  NEEDS_REVISION: {
    label: 'Needs Revision',
    bgColor: 'bg-amber-100',
    textColor: 'text-amber-700',
    borderColor: 'border-amber-300'
  },
  
  // ✅ TAMBAH: Status Lama (Backward Compatibility)
  APPROVED: {
    label: 'Approved',
    bgColor: 'bg-green-100',
    textColor: 'text-green-700',
    borderColor: 'border-green-300'
  },
  REVISED: {
    label: 'Revised',
    bgColor: 'bg-purple-100',
    textColor: 'text-purple-700',
    borderColor: 'border-purple-300'
  }
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ 
  status, 
  size = 'md',
  className 
}) => {
  // ✅ FIX: Fallback untuk status yang tidak dikenal
  const config = statusConfig[status] || {
    label: status || 'Unknown',
    bgColor: 'bg-gray-100',
    textColor: 'text-gray-700',
    borderColor: 'border-gray-300'
  };
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1'
  };

  return (
    <Badge
      variant="outline"
      className={cn(
        'font-medium border rounded-full capitalize',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
    >
      {config.label}
    </Badge>
  );
};

export default StatusBadge;