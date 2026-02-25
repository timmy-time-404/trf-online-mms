import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTRFStore, useAuthStore } from '@/store';
import type { TRF, UserRole } from '@/types';
import {
  CheckSquare,
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  User,
  Calendar,
  MapPin,
  Clock,
  AlertCircle,
  Users,
  Shield,
  Briefcase
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const ApprovalPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { 
    getTRFsForApproval, 
    getTRFsForPMApproval,
    hodApproveTRF,
    hrApproveTRF,
    pmApproveTRF
  } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [actionType, setActionType] = useState<'APPROVE' | 'REJECT' | 'REVISE' | null>(null);
  const [remarks, setRemarks] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);

  const userRole = currentUser?.role as UserRole;
  
  // Get TRFs based on role
  const getPendingTRFs = () => {
    if (userRole === 'PM') {
      return getTRFsForPMApproval();
    }
    return getTRFsForApproval(currentUser!);
  };

  const pendingTRFs = getPendingTRFs();

  const handleAction = (trf: TRF, action: 'APPROVE' | 'REJECT' | 'REVISE') => {
    setSelectedTRF(trf);
    setActionType(action);
    setRemarks('');
    setDialogOpen(true);
  };

  const confirmAction = () => {
    if (!selectedTRF || !currentUser || !actionType) return;

    const { id } = selectedTRF;
    const userId = currentUser.id;
    const userName = currentUser.username;

    try {
      switch (userRole) {
        case 'HOD':
          hodApproveTRF(id, userId, userName, actionType === 'APPROVE', remarks);
          break;
        case 'HR':
          hrApproveTRF(id, userId, userName, actionType === 'APPROVE', remarks);
          break;
        case 'PM':
          pmApproveTRF(id, userId, userName, actionType === 'APPROVE', remarks);
          break;
      }

      const actionLabels = {
        'APPROVE': 'approved',
        'REJECT': 'rejected',
        'REVISE': 'returned for revision'
      };

      toast.success(`TRF ${selectedTRF.trfNumber} ${actionLabels[actionType]}`);
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

  const getRoleIcon = () => {
    switch (userRole) {
      case 'HOD': return Briefcase;
      case 'HR': return Users;
      case 'PM': return Shield;
      default: return CheckSquare;
    }
  };

  const getRoleTitle = () => {
    switch (userRole) {
      case 'HOD': return 'Head of Department Approval';
      case 'HR': return 'HR Approval';
      case 'PM': return 'Final Approval (PM)';
      default: return 'Approvals';
    }
  };

  const getRoleDescription = () => {
    switch (userRole) {
      case 'HOD': return 'Approve TRFs for your department';
      case 'HR': return 'Approve TRFs from all departments';
      case 'PM': return 'Final approval for all TRFs';
      default: return 'Review and approve travel requests';
    }
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

  const getParallelStatus = (trf: TRF) => {
    if (!trf.parallelApproval) return null;

    const hodStatus = trf.parallelApproval.hod?.status;
    const hrStatus = trf.parallelApproval.hr?.status;

    return (
      <div className="flex gap-2 mt-2">
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs",
            hodStatus === 'APPROVED' ? "bg-green-50 text-green-700 border-green-300" :
            hodStatus === 'REJECTED' ? "bg-red-50 text-red-700 border-red-300" :
            "bg-gray-50 text-gray-600 border-gray-300"
          )}
        >
          HoD: {hodStatus || 'PENDING'}
        </Badge>
        <Badge 
          variant="outline" 
          className={cn(
            "text-xs",
            hrStatus === 'APPROVED' ? "bg-green-50 text-green-700 border-green-300" :
            hrStatus === 'REJECTED' ? "bg-red-50 text-red-700 border-red-300" :
            "bg-gray-50 text-gray-600 border-gray-300"
          )}
        >
          HR: {hrStatus || 'PENDING'}
        </Badge>
      </div>
    );
  };

  const actionConfig = getActionConfig();
  const RoleIcon = getRoleIcon();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{getRoleTitle()}</h1>
        <p className="text-gray-500 mt-1">{getRoleDescription()}</p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Card className="flex-1 bg-blue-50 border-blue-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <RoleIcon className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-900">{pendingTRFs.length}</p>
              <p className="text-sm text-blue-700">Pending Approval</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Role Info */}
      <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-amber-900">
            {userRole === 'HOD' && `Department: ${currentUser?.department}`}
            {userRole === 'HR' && 'HR: Approve all TRFs (can request revision)'}
            {userRole === 'PM' && 'PM: Final approval after HoD & HR'}
          </p>
          <p className="text-sm text-amber-700 mt-1">
            {userRole === 'HOD' && 'You can only approve TRFs from your department.'}
            {userRole === 'HR' && 'Both HoD and you must approve before PM.'}
            {userRole === 'PM' && 'TRF will be sent to GA after your approval.'}
          </p>
        </div>
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
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                        {trf.status === 'PARALLEL_APPROVED' ? 'PM APPROVAL' : trf.status}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Requestor</p>
                          <p className="text-sm font-medium text-gray-900">{trf.employee?.employeeName}</p>
                          <p className="text-xs text-gray-400">{trf.department}</p>
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

                    {/* Show parallel approval status for HoD and HR */}
                    {(userRole === 'HOD' || userRole === 'HR') && getParallelStatus(trf)}

                    {/* Show verification info */}
                    {trf.adminDeptVerify && (
                      <div className="p-3 bg-green-50 rounded-lg mt-3">
                        <p className="text-xs text-green-700 font-medium">
                          ✓ Verified by {trf.adminDeptVerify.verifierName}
                        </p>
                        {trf.adminDeptVerify.remarks && (
                          <p className="text-sm text-green-600 mt-1">{trf.adminDeptVerify.remarks}</p>
                        )}
                      </div>
                    )}
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
                    {userRole !== 'PM' && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-purple-600 border-purple-200 hover:bg-purple-50"
                        onClick={() => handleAction(trf, 'REVISE')}
                      >
                        <RotateCcw className="w-4 h-4 mr-1" />
                        Revise
                      </Button>
                    )}
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
                <label className="text-sm font-medium">
                  Remarks {actionType === 'REJECT' && <span className="text-red-500">*</span>}
                </label>
                <Textarea
                  placeholder="Add any comments or notes..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                  className="resize-none"
                  required={actionType === 'REJECT'}
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
                  disabled={actionType === 'REJECT' && !remarks.trim()}
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