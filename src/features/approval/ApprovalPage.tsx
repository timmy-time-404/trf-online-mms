import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import StatusBadge from '@/components/common/StatusBadge';
import { useTRFStore, useAuthStore } from '@/store';
import type { TRF } from '@/types';
import {
  CheckSquare,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  User,
  Calendar,
  MapPin
} from 'lucide-react';
import { toast } from 'sonner';

const ApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { getPendingApprovals, approveTRF, rejectTRF, reviseTRF } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REVISE' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const pendingTRFs = getPendingApprovals();

  const handleAction = (trf: TRF, action: 'APPROVE' | 'REJECT' | 'REVISE') => {
    setSelectedTRF(trf);
    setActionType(action);
    setRemarks('');
    setDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedTRF || !currentUser || !actionType) return;

    const approverName = currentUser.username;

    try {
      switch (actionType) {
        case 'APPROVE':
          approveTRF(selectedTRF.id, currentUser.id, approverName, remarks);
          toast.success(`TRF ${selectedTRF.trfNumber} approved successfully`);
          break;
        case 'REJECT':
          rejectTRF(selectedTRF.id, currentUser.id, approverName, remarks);
          toast.success(`TRF ${selectedTRF.trfNumber} rejected`);
          break;
        case 'REVISE':
          reviseTRF(selectedTRF.id, currentUser.id, approverName, remarks);
          toast.success(`TRF ${selectedTRF.trfNumber} returned for revision`);
          break;
      }
      setDialogOpen(false);
      setSelectedTRF(null);
      setActionType(null);
      setRemarks('');
    } catch (error) {
      toast.error('Failed to process TRF');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getActionConfig = () => {
    switch (actionType) {
      case 'APPROVE':
        return {
          title: 'Approve TRF',
          description: `Are you sure you want to approve ${selectedTRF?.trfNumber}?`,
          confirmText: 'Approve',
          confirmClass: 'bg-green-600 hover:bg-green-700',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'REJECT':
        return {
          title: 'Reject TRF',
          description: `Are you sure you want to reject ${selectedTRF?.trfNumber}?`,
          confirmText: 'Reject',
          confirmClass: 'bg-red-600 hover:bg-red-700',
          icon: XCircle,
          iconColor: 'text-red-600'
        };
      case 'REVISE':
        return {
          title: 'Request Revision',
          description: `Return ${selectedTRF?.trfNumber} to the requestor for revision.`,
          confirmText: 'Request Revision',
          confirmClass: 'bg-purple-600 hover:bg-purple-700',
          icon: RotateCcw,
          iconColor: 'text-purple-600'
        };
      default:
        return null;
    }
  };

  const actionConfig = getActionConfig();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Pending Approvals</h1>
        <p className="text-gray-500 mt-1">
          Review and approve travel request forms
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Card className="flex-1 bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{pendingTRFs.length}</p>
              <p className="text-sm text-blue-700">Pending Approvals</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending TRF List */}
      {pendingTRFs.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="p-12 text-center">
            <CheckSquare className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No Pending Approvals</h3>
            <p className="text-gray-500 mt-1">All travel requests have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingTRFs.map((trf) => (
            <Card key={trf.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900">{trf.trfNumber}</h3>
                      <StatusBadge status="SUBMITTED" size="sm" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Requestor</p>
                          <p className="text-sm font-medium text-gray-900">{trf.employee?.employeeName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Travel Dates</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(trf.startDate)} - {formatDate(trf.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Purpose</p>
                          <p className="text-sm font-medium text-gray-900">{trf.travelPurpose}</p>
                        </div>
                      </div>
                    </div>

                    <p className="text-sm text-gray-600">
                      Submitted on {formatDate(trf.submittedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/trf/${trf.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleAction(trf, 'APPROVE')}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-purple-600 border-purple-200 hover:bg-purple-50"
                      onClick={() => handleAction(trf, 'REVISE')}
                    >
                      <RotateCcw className="w-4 h-4 mr-1" />
                      Revise
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleAction(trf, 'REJECT')}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          {actionConfig && (
            <>
              <DialogHeader className="gap-4">
                <div className={`w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto`}>
                  <actionConfig.icon className={`w-6 h-6 ${actionConfig.iconColor}`} />
                </div>
                <DialogTitle className="text-center text-xl">{actionConfig.title}</DialogTitle>
                <DialogDescription className="text-center text-base">
                  {actionConfig.description}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2">
                <label className="text-sm font-medium">Remarks (Optional)</label>
                <Textarea
                  placeholder="Add any comments or notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <DialogFooter className="gap-3 sm:gap-0 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={confirmAction}
                  className={`flex-1 ${actionConfig.confirmClass}`}
                >
                  {actionConfig.confirmText}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ApprovalPage;
