import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

import { useTRFStore, useAuthStore } from '@/store';
import type { TRF, UserRole } from '@/types';

import {
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText
} from 'lucide-react';

import { toast } from 'sonner';
import { getApprovalPermission } from '@/lib/approvalEngine';

const ApprovalPage: React.FC = () => {

  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const {
    getTRFs,
    hodApproveTRF,
    hrApproveTRF,
    pmApproveTRF
  } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [remarks, setRemarks] = useState('');
  const [action, setAction] =
    useState<'APPROVE' | 'REJECT' | 'REVISE' | null>(null);

  const userRole = currentUser?.role as UserRole;

  /* =========================================================
     FILTER TRF BERDASARKAN WORKFLOW (SEQUENTIAL)
  ========================================================= */

  const pendingTRFs = getTRFs().filter(trf => {

  if (userRole === 'ADMIN_DEPT')
    return trf.status === 'SUBMITTED';

  if (userRole === 'HOD')
    return trf.status === 'ADMIN_DEPT_VERIFIED';

  if (userRole === 'HR')
    return trf.status === 'HOD_APPROVED';

  if (userRole === 'PM')
    return trf.status === 'HR_APPROVED';

  return false;
});

  /* =========================================================
     ACTION HANDLER
  ========================================================= */

  const openDialog = (
    trf: TRF,
    type: 'APPROVE' | 'REJECT' | 'REVISE'
  ) => {
    setSelectedTRF(trf);
    setAction(type);
    setRemarks('');
  };

  const executeAction = () => {

    if (!selectedTRF || !currentUser || !action) return;

    if (!remarks.trim()) {
      toast.error('Remarks wajib diisi');
      return;
    }

    const id = selectedTRF.id;
    const uid = currentUser.id;
    const uname = currentUser.username;

    try {

      if (userRole === 'HOD')
        hodApproveTRF(id, uid, uname, action === 'APPROVE', remarks);

      if (userRole === 'HR')
        hrApproveTRF(id, uid, uname, action === 'APPROVE', remarks);

      if (userRole === 'PM')
        pmApproveTRF(id, uid, uname, action === 'APPROVE', remarks);

      toast.success(`TRF ${selectedTRF.trfNumber} processed`);

      setSelectedTRF(null);
      setAction(null);
      setRemarks('');

    } catch {
      toast.error('Action failed');
    }
  };

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="space-y-6">

      <h1 className="text-2xl font-bold">
        Approval - {userRole}
      </h1>

      {pendingTRFs.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center">
            No pending approvals
          </CardContent>
        </Card>
      )}

      {pendingTRFs.map(trf => {

        const permission =
          getApprovalPermission(trf, userRole);

        return (
          <Card key={trf.id}>
            <CardContent className="p-6 flex justify-between">

              {/* LEFT INFO */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5" />
                  <h3 className="font-semibold">
                    {trf.trfNumber}
                  </h3>
                  <Badge>{trf.status}</Badge>
                </div>

                <p className="text-sm text-gray-600">
                  {trf.employee?.employeeName}
                </p>

                <p className="text-sm text-gray-500">
                  {trf.travelPurpose}
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex gap-2">

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/trf/${trf.id}`)}
                >
                  <Eye className="w-4 h-4 mr-1"/>
                  View
                </Button>

                {permission.canApprove && (
                  <Button
                    size="sm"
                    className="bg-green-600"
                    onClick={() => openDialog(trf,'APPROVE')}
                  >
                    <CheckCircle className="w-4 h-4 mr-1"/>
                    Approve
                  </Button>
                )}

                {permission.canReject && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600"
                    onClick={() => openDialog(trf,'REJECT')}
                  >
                    <XCircle className="w-4 h-4 mr-1"/>
                    Reject
                  </Button>
                )}

                {permission.canRevise && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openDialog(trf,'REVISE')}
                  >
                    <RotateCcw className="w-4 h-4 mr-1"/>
                    Revise
                  </Button>
                )}

              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ================= DIALOG ================= */}

      <Dialog
        open={!!selectedTRF}
        onOpenChange={() => setSelectedTRF(null)}
      >
        <DialogContent>

          <DialogHeader>
            <DialogTitle>Confirmation</DialogTitle>
          </DialogHeader>

          <Textarea
            placeholder="Remarks wajib diisi..."
            value={remarks}
            onChange={(e)=>setRemarks(e.target.value)}
          />

          <DialogFooter>
            <Button
              variant="outline"
              onClick={()=>setSelectedTRF(null)}
            >
              Cancel
            </Button>

            <Button onClick={executeAction}>
              Confirm
            </Button>
          </DialogFooter>

        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ApprovalPage;