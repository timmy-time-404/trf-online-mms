import React from 'react';
import { useNavigate } from 'react-router-dom';

import ConfirmDialog from '@/components/common/ConfirmDialog';
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
  Eye,
  FileSpreadsheet,
  FileText,
  Loader2,
  Plus,
  RotateCcw,
  Search,
  Shield,
} from 'lucide-react';

import {
  useAuthStore,
  useTRFStore,
} from '@/store';

import type {
  TRFStatus,
  UserRole,
} from '@/types';

import { exportAllTRFsToExcel } from '@/utils/exportAllTRFsToExcel';

import TRFListTable from './components/TRFListTable';

const EXPORT_ALLOWED_ROLES: UserRole[] = [
  'HOD',
  'HR',
  'PM',
  'GA',
  'SUPER_ADMIN',
];

const STATUS_FILTER_OPTIONS: {
  value: TRFStatus | 'ALL';
  label: string;
}[] = [
  { value: 'ALL', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'SUBMITTED', label: 'Submitted' },
  {
    value: 'ADMIN_DEPT_VERIFIED',
    label: 'Admin Dept Verified',
  },
  {
    value: 'PENDING_APPROVAL',
    label: 'Pending Approval',
  },
  {
    value: 'HOD_APPROVED',
    label: 'HoD Approved',
  },
  {
    value: 'HR_APPROVED',
    label: 'HR Approved',
  },
  {
    value: 'PM_APPROVED',
    label: 'PM Approved',
  },
  {
    value: 'GA_PROCESSED',
    label: 'GA Processed',
  },
  { value: 'REJECTED', label: 'Rejected' },
  {
    value: 'NEEDS_REVISION',
    label: 'Needs Revision',
  },
  { value: 'REVISED', label: 'Revised' },
];

const TRFListPage: React.FC = () => {
  const navigate = useNavigate();

  const currentUser = useAuthStore(
    (state) => state.currentUser,
  );

  const deleteTRF = useTRFStore(
    (state) => state.deleteTRF,
  );

  const getVisibleTRFs = useTRFStore(
    (state) => state.getVisibleTRFs,
  );

  const [searchQuery, setSearchQuery] =
    React.useState('');

  const [statusFilter, setStatusFilter] =
    React.useState<TRFStatus | 'ALL'>('ALL');

  const [deleteDialogOpen, setDeleteDialogOpen] =
    React.useState(false);

  const [trfToDelete, setTrfToDelete] =
    React.useState<string | null>(null);

  const [isExporting, setIsExporting] =
    React.useState(false);

  const visibleTRFs = React.useMemo(
    () =>
      currentUser
        ? getVisibleTRFs(currentUser)
        : [],
    [currentUser, getVisibleTRFs],
  );

  const filteredTRFs = React.useMemo(() => {
    const normalizedSearch = searchQuery
      .trim()
      .toLowerCase();

    return [...visibleTRFs]
      .filter((trf) => {
        if (
          statusFilter !== 'ALL' &&
          trf.status !== statusFilter
        ) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        const searchableValues = [
          trf.trfNumber,
          trf.employee?.employeeName,
          trf.employee?.employeeCode,
          trf.travelPurpose,
          trf.department,
        ];

        return searchableValues.some((value) =>
          value
            ?.toLowerCase()
            .includes(normalizedSearch),
        );
      })
      .sort(
        (first, second) =>
          new Date(second.createdAt).getTime() -
          new Date(first.createdAt).getTime(),
      );
  }, [searchQuery, statusFilter, visibleTRFs]);

  const hasActiveFilter =
    searchQuery.trim().length > 0 ||
    statusFilter !== 'ALL';

  const canExportAll =
    Boolean(currentUser) &&
    EXPORT_ALLOWED_ROLES.includes(
      currentUser!.role,
    );

  const handleExportAll = async () => {
    if (filteredTRFs.length === 0) {
      return;
    }

    setIsExporting(true);

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, 200),
      );

      exportAllTRFsToExcel(
        filteredTRFs,
        currentUser?.role,
      );
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDelete = (id: string) => {
    setTrfToDelete(id);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (!trfToDelete) {
      return;
    }

    void deleteTRF(trfToDelete);
    setTrfToDelete(null);
    setDeleteDialogOpen(false);
  };

  const resetFilters = () => {
    setSearchQuery('');
    setStatusFilter('ALL');
  };

  const getVisibilityInfo = (): string => {
    if (!currentUser) {
      return '';
    }

    switch (currentUser.role) {
      case 'EMPLOYEE':
        return 'Showing your TRFs only';

      case 'ADMIN_DEPT':
      case 'HOD':
        return `Showing ${
          currentUser.department ?? 'your'
        } department TRFs`;

      default:
        return 'Showing all TRFs';
    }
  };

  const summary = React.useMemo(
    () => ({
      needVerification: visibleTRFs.filter(
        (trf) => trf.status === 'SUBMITTED',
      ).length,

      needApproval: visibleTRFs.filter(
        (trf) =>
          trf.status === 'PENDING_APPROVAL',
      ).length,

      completed: visibleTRFs.filter(
        (trf) => trf.status === 'GA_PROCESSED',
      ).length,

      total: visibleTRFs.length,
    }),
    [visibleTRFs],
  );

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Travel Request Forms
          </h1>

          <p className="mt-1 flex items-center gap-2 text-sm text-gray-500 sm:text-base">
            <Eye className="h-4 w-4 shrink-0" />
            <span>{getVisibilityInfo()}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {canExportAll && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={
                isExporting ||
                filteredTRFs.length === 0
              }
              className="gap-2 border-green-300 text-green-700 hover:border-green-400 hover:bg-green-50"
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}

              {isExporting
                ? 'Exporting...'
                : `Export Excel (${filteredTRFs.length})`}
            </Button>
          )}

          {currentUser?.role === 'EMPLOYEE' && (
            <Button
              type="button"
              onClick={() => navigate('/trf/new')}
            >
              <Plus className="mr-2 h-4 w-4" />
              New TRF
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />

            <Input
              placeholder="Search by TRF number, employee, Employee ID, purpose..."
              value={searchQuery}
              onChange={(event) =>
                setSearchQuery(event.target.value)
              }
              className="w-full pl-10"
            />
          </div>

          <Select
            value={statusFilter}
            onValueChange={(value) =>
              setStatusFilter(
                value as TRFStatus | 'ALL',
              )
            }
          >
            <SelectTrigger className="w-full lg:w-64">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>

            <SelectContent
              position="popper"
              align="start"
              sideOffset={6}
              className="max-h-80 w-[var(--radix-select-trigger-width)]"
            >
              {STATUS_FILTER_OPTIONS.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasActiveFilter && (
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="w-full gap-2 lg:w-auto"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Filter
            </Button>
          )}
        </div>

        <div className="mt-3 text-xs text-gray-500">
          Showing{' '}
          <span className="font-semibold text-gray-700">
            {filteredTRFs.length}
          </span>{' '}
          of{' '}
          <span className="font-semibold text-gray-700">
            {visibleTRFs.length}
          </span>{' '}
          TRFs
        </div>
      </div>

      <div className="flex flex-wrap gap-2 sm:gap-3">
        {currentUser?.role !== 'EMPLOYEE' && (
          <>
            <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 text-sm">
              <Shield className="h-4 w-4 text-blue-600" />
              <span className="text-blue-700">
                {summary.needVerification}{' '}
                Need Verification
              </span>
            </div>

            <div className="flex items-center gap-2 rounded-full bg-purple-50 px-3 py-1.5 text-sm">
              <Shield className="h-4 w-4 text-purple-600" />
              <span className="text-purple-700">
                {summary.needApproval}{' '}
                Need Approval
              </span>
            </div>
          </>
        )}

        <div className="flex items-center gap-2 rounded-full bg-green-50 px-3 py-1.5 text-sm">
          <FileText className="h-4 w-4 text-green-600" />
          <span className="text-green-700">
            {summary.completed} Completed
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-full bg-gray-100 px-3 py-1.5 text-sm">
          <FileText className="h-4 w-4 text-gray-600" />
          <span className="text-gray-700">
            Total: {summary.total}
          </span>
        </div>
      </div>

      {filteredTRFs.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-16 text-center">
          <FileText className="mx-auto mb-4 h-14 w-14 text-gray-300" />

          <h3 className="text-lg font-semibold text-gray-700">
            No Travel Requests Found
          </h3>

          <p className="mt-1 text-sm text-gray-500">
            {hasActiveFilter
              ? 'No TRFs match your current filters.'
              : currentUser?.role === 'EMPLOYEE'
                ? "You haven't submitted any travel requests yet."
                : 'No travel requests have been submitted yet.'}
          </p>

          {hasActiveFilter && (
            <Button
              type="button"
              variant="outline"
              onClick={resetFilters}
              className="mt-4 gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Reset Filter
            </Button>
          )}

          {currentUser?.role === 'EMPLOYEE' &&
            !hasActiveFilter && (
              <Button
                type="button"
                className="mt-4"
                onClick={() => navigate('/trf/new')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create your first TRF
              </Button>
            )}
        </div>
      )}

      {filteredTRFs.length > 0 && (
        <TRFListTable
          trfs={filteredTRFs}
          onDelete={
            currentUser?.role === 'EMPLOYEE'
              ? handleDelete
              : undefined
          }
        />
      )}

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete TRF"
        description="Are you sure you want to delete this TRF? This action cannot be undone."
        onConfirm={confirmDelete}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default TRFListPage;