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
import type { TRFStatus } from '@/types';
import { Plus, Search, FileText, Eye, Shield } from 'lucide-react';

const TRFListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { deleteTRF, getVisibleTRFs } = useTRFStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TRFStatus | 'ALL'>('ALL');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trfToDelete, setTrfToDelete] = useState<string | null>(null);

  // Get TRFs based on user role visibility
  const visibleTRFs = currentUser ? getVisibleTRFs(currentUser) : [];

  // Filter TRFs
  const getFilteredTRFs = () => {
    let filtered = [...visibleTRFs];

    // Status filter
    if (statusFilter !== 'ALL') {
      filtered = filtered.filter(trf => trf.status === statusFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(trf =>
        trf.trfNumber.toLowerCase().includes(query) ||
        trf.employee?.employeeName.toLowerCase().includes(query) ||
        trf.travelPurpose.toLowerCase().includes(query) ||
        trf.department?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  };

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

  const filteredTRFs = getFilteredTRFs();

  // Get visibility info text
  const getVisibilityInfo = () => {
    if (!currentUser) return '';
    
    switch (currentUser.role) {
      case 'EMPLOYEE':
        return 'Showing your TRFs only';
      case 'ADMIN_DEPT':
      case 'HOD':
        return `Showing ${currentUser.department} department TRFs`;
      case 'HR':
      case 'PM':
      case 'GA':
      case 'SUPER_ADMIN':
        return 'Showing all TRFs';
      default:
        return '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Request Forms</h1>
          <p className="text-gray-500 mt-1 flex items-center gap-2">
            <Eye className="w-4 h-4" />
            {getVisibilityInfo()}
          </p>
        </div>
        {currentUser?.role === 'EMPLOYEE' && (
          <Button onClick={() => navigate('/trf/new')}>
            <Plus className="w-4 h-4 mr-2" />
            New TRF
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder="Search by TRF number, employee, purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as TRFStatus | 'ALL')}
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

      {/* Stats Summary */}
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

      {/* TRF List */}
      <TRFListTable
        trfs={filteredTRFs}
        onDelete={currentUser?.role === 'EMPLOYEE' ? handleDelete : undefined}
      />

      {/* Delete Confirmation */}
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