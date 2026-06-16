import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import TRFListTable from './components/TRFListTable';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore, useAuthStore } from '@/store';
import { exportAllTRFsToExcel } from '@/utils/exportAllTRFsToExcel';
import type { TRFStatus, UserRole } from '@/types';
import {
  Plus,
  Search,
  FileText,
  Eye,
  Shield,
  FileSpreadsheet,
  Loader2,
} from 'lucide-react';
 
// Role yang boleh export all
const EXPORT_ALLOWED_ROLES: UserRole[] = ['HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'];
 
const TRFListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser }             = useAuthStore();
  const { deleteTRF, getVisibleTRFs } = useTRFStore();
 
  const [searchQuery, setSearchQuery]   = useState('');
  const [statusFilter, setStatusFilter] = useState<TRFStatus | 'ALL'>('ALL');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trfToDelete, setTrfToDelete]   = useState<string | null>(null);
  const [isExporting, setIsExporting]   = useState(false);
 
  const visibleTRFs = currentUser ? getVisibleTRFs(currentUser) : [];
 
  const getFilteredTRFs = () => {
    let filtered = [...visibleTRFs];
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(t => t.status === statusFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(t =>
        t.trfNumber.toLowerCase().includes(q)             ||
        t.employee?.employeeName.toLowerCase().includes(q)||
        t.travelPurpose.toLowerCase().includes(q)         ||
        t.department?.toLowerCase().includes(q)
      );
    }
    return filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };
 
  const filteredTRFs = getFilteredTRFs();
 
  // ── Export All handler ────────────────────────────────────
  const handleExportAll = async () => {
    if (filteredTRFs.length === 0) {
      return;
    }
    setIsExporting(true);
    try {
      await new Promise(r => setTimeout(r, 200));
      exportAllTRFsToExcel(filteredTRFs, currentUser?.role);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };
 
  // ── Delete handlers ───────────────────────────────────────
  const handleDelete = (id: string) => {
    setTrfToDelete(id);
    setDeleteDialogOpen(true);
  };
 
  const confirmDelete = () => {
    if (trfToDelete) {
      deleteTRF(trfToDelete);
      setTrfToDelete(null);
      setDeleteDialogOpen(false);
    }
  };
 
  // ── Visibility text ───────────────────────────────────────
  const getVisibilityInfo = () => {
    if (!currentUser) return '';
    switch (currentUser.role) {
      case 'EMPLOYEE'   : return 'Showing your TRFs only';
      case 'ADMIN_DEPT' :
      case 'HOD'        : return `Showing ${currentUser.department} department TRFs`;
      default           : return 'Showing all TRFs';
    }
  };
 
  const canExportAll = currentUser && EXPORT_ALLOWED_ROLES.includes(currentUser.role);
 
  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Request Forms</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            {getVisibilityInfo()}
          </p>
        </div>
 
        <div className="flex items-center gap-2">
          {/* Export All — hanya untuk HoD+ */}
          {canExportAll && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAll}
              disabled={isExporting || filteredTRFs.length === 0}
              className="gap-2 text-green-700 border-green-300 hover:bg-green-50 hover:border-green-400"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4" />
              )}
              {isExporting ? 'Exporting...' : `Export Excel (${filteredTRFs.length})`}
            </Button>
          )}
 
          {/* New TRF — hanya untuk employee */}
          {currentUser?.role === 'EMPLOYEE' && (
            <Button onClick={() => navigate('/trf/new')}>
              <Plus className="w-4 h-4 mr-2" />
              New TRF
            </Button>
          )}
        </div>
      </div>
 
      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by TRF number, employee, purpose..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={v => setStatusFilter(v as TRFStatus | 'ALL')}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="HOD_APPROVED">HoD Approved</SelectItem>
            <SelectItem value="HR_APPROVED">HR Approved</SelectItem>
            <SelectItem value="PARALLEL_APPROVED">Parallel Approved</SelectItem>
            <SelectItem value="PM_APPROVED">PM Approved</SelectItem>
            <SelectItem value="GA_PROCESSED">GA Processed</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="NEEDS_REVISION">Needs Revision</SelectItem>
          </SelectContent>
        </Select>
      </div>
 
      {/* ── Stats ── */}
      <div className="flex flex-wrap gap-4">
        {currentUser?.role !== 'EMPLOYEE' && (
          <>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full text-sm">
              <Shield className="w-4 h-4 text-blue-600" />
              <span className="text-blue-700">
                {filteredTRFs.filter(t => t.status === 'SUBMITTED').length} Need Verification
              </span>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-50 rounded-full text-sm">
              <Shield className="w-4 h-4 text-purple-600" />
              <span className="text-purple-700">
                {filteredTRFs.filter(t => t.status === 'PENDING_APPROVAL').length} Need Approval
              </span>
            </div>
          </>
        )}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-full text-sm">
          <FileText className="w-4 h-4 text-green-600" />
          <span className="text-green-700">
            {filteredTRFs.filter(t => t.status === 'GA_PROCESSED').length} Completed
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm">
          <FileText className="w-4 h-4 text-gray-600" />
          <span className="text-gray-700">Total: {filteredTRFs.length}</span>
        </div>
      </div>
 
      {/* ── Empty state ── */}
      {filteredTRFs.length === 0 && (
        <div className="text-center py-16 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <FileText className="w-14 h-14 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-700">No Travel Requests Found</h3>
          <p className="text-gray-500 mt-1 text-sm">
            {searchQuery || statusFilter !== 'ALL'
              ? 'No TRFs match your current filters.'
              : currentUser?.role === 'EMPLOYEE'
              ? 'You haven\'t submitted any travel requests yet.'
              : 'No travel requests have been submitted yet.'}
          </p>
          {currentUser?.role === 'EMPLOYEE' && !searchQuery && statusFilter === 'ALL' && (
            <Button
              className="mt-4"
              onClick={() => navigate('/trf/new')}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create your first TRF
            </Button>
          )}
        </div>
      )}
 
      {/* ── Table ── */}
      {filteredTRFs.length > 0 && (
        <TRFListTable
          trfs={filteredTRFs}
          onDelete={currentUser?.role === 'EMPLOYEE' ? handleDelete : undefined}
        />
      )}
 
      {/* ── Delete dialog ── */}
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