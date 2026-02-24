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
import { Plus, Search, FileText } from 'lucide-react';

const TRFListPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { trfs, deleteTRF, getTRFsByEmployee } = useTRFStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<TRFStatus | 'ALL'>('ALL');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [trfToDelete, setTrfToDelete] = useState<string | null>(null);

  // Filter TRFs based on user role
  const getFilteredTRFs = () => {
    let filtered = trfs;

    // Role-based filtering
    if (currentUser?.role === 'EMPLOYEE' && currentUser.employeeId) {
      filtered = getTRFsByEmployee(currentUser.employeeId);
    }

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
        trf.travelPurpose.toLowerCase().includes(query)
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Travel Request Forms</h1>
          <p className="text-gray-500 mt-1">
            Manage and track travel requests
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
            placeholder="Search by TRF number, employee, or purpose..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(value) => setStatusFilter(value as TRFStatus | 'ALL')}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="REVISED">Revised</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Summary */}
      <div className="flex flex-wrap gap-4">
        {(['DRAFT', 'SUBMITTED', 'APPROVED', 'REVISED', 'REJECTED'] as TRFStatus[]).map((status) => {
          const count = filteredTRFs.filter(t => t.status === status).length;
          if (count === 0) return null;
          return (
            <div
              key={status}
              className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 rounded-full text-sm"
            >
              <span className="font-medium text-gray-700">{status}:</span>
              <span className="text-gray-900">{count}</span>
            </div>
          );
        })}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-full text-sm">
          <FileText className="w-4 h-4 text-blue-600" />
          <span className="font-medium text-blue-700">Total: {filteredTRFs.length}</span>
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
