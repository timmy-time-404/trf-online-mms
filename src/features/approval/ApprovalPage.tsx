import React, { useState, useEffect } from 'react';
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
// ❌ REVISI: Kita hapus getApprovalPermission karena tidak dibutuhkan lagi
// import { getApprovalPermission } from '@/lib/approvalEngine';

const ApprovalPage: React.FC = () => {

  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const {
    getTRFsForApproval,
    fetchTRFs,
    pmApproveTRF, 
    approveTRF,   
    rejectTRF     
  } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [remarks, setRemarks] = useState('');
  const [action, setAction] = useState<'REVISE' | null>(null);

  const userRole = currentUser?.role as UserRole;

  // Auto Fetch Wajib
  useEffect(() => {
    fetchTRFs();
  }, [fetchTRFs]);

  /* =========================================================
     FILTER TRF BERDASARKAN WORKFLOW (SEQUENTIAL)
  ========================================================= */

  const pendingTRFs = currentUser
    ? getTRFsForApproval(currentUser.role, currentUser.department)
    : [];

  /* =========================================================
     ACTION HANDLER (Hanya untuk Revise sekarang)
  ========================================================= */

  const openDialog = (trf: TRF) => {
    setSelectedTRF(trf);
    setAction('REVISE');
    setRemarks('');
  };

  const executeReviseAction = () => {
    if (!selectedTRF || !currentUser || action !== 'REVISE') return;

    if (!remarks.trim()) {
      toast.error('Remarks wajib diisi untuk revisi');
      return;
    }

    toast.info(`Fitur revisi sedang dikembangkan untuk TRF ${selectedTRF.trfNumber}`);
    
    setSelectedTRF(null);
    setAction(null);
    setRemarks('');
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
          <CardContent className="p-10 text-center text-gray-500">
            No pending approvals
          </CardContent>
        </Card>
      )}

      {pendingTRFs.map(trf => {
        // ❌ REVISI: Hapus pengecekan permission yang menghalangi tombol
        // const permission = getApprovalPermission(trf, userRole);

        return (
          <Card key={trf.id}>
            <CardContent className="p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">

              {/* LEFT INFO */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <h3 className="font-semibold text-lg">
                    {trf.trfNumber}
                  </h3>
                  <Badge variant="secondary">{trf.status}</Badge>
                </div>

                <p className="text-sm font-medium text-gray-900">
                  {trf.employee?.employeeName || 'Unknown Employee'}
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  {trf.travelPurpose}
                </p>
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap gap-2">

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate(`/trf/${trf.id}`)}
                >
                  <Eye className="w-4 h-4 mr-1"/>
                  View
                </Button>

                {/* ✅ REVISI: Tampilkan tombol Approve langsung tanpa dibatasi permission */}
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={async () => {
                    if (!currentUser) return;
                    
                    try {
                      if (currentUser.role === 'PM') {
                        await pmApproveTRF(trf.id, currentUser.id, currentUser.username, true, 'Approved by PM');
                      } else if (currentUser.role === 'HOD' || currentUser.role === 'HR') {
                        await approveTRF(
                          trf.id,
                          currentUser.role,
                          currentUser.id,
                          currentUser.username,
                          `Approved by ${currentUser.role}`
                        );
                      }
                      
                      toast.success(`TRF ${trf.trfNumber} Approved!`);
                    } catch {
                      toast.error('Gagal melakukan Approve');
                    }
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-1"/>
                  Approve
                </Button>

                {/* ✅ REVISI: Tampilkan tombol Reject langsung */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={async () => {
                    if (!currentUser) return;
                    
                    try {
                      if (currentUser.role === 'PM') {
                        await pmApproveTRF(trf.id, currentUser.id, currentUser.username, false, 'Rejected by PM');
                      } else if (currentUser.role === 'HOD' || currentUser.role === 'HR') {
                        await rejectTRF(
                          trf.id,
                          currentUser.role,
                          currentUser.id,
                          currentUser.username,
                          `Rejected by ${currentUser.role}`
                        );
                      }
                      
                      toast.error(`TRF ${trf.trfNumber} Rejected!`);
                    } catch {
                      toast.error('Gagal melakukan Reject');
                    }
                  }}
                >
                  <XCircle className="w-4 h-4 mr-1"/>
                  Reject
                </Button>

                {/* ✅ REVISI: Tampilkan tombol Revise langsung */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDialog(trf)}
                >
                  <RotateCcw className="w-4 h-4 mr-1"/>
                  Revise
                </Button>

              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ================= DIALOG HANYA UNTUK REVISE ================= */}

      <Dialog
        open={!!selectedTRF}
        onOpenChange={() => setSelectedTRF(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revise Request</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            <label className="text-sm font-medium">Alasan Revisi <span className="text-red-500">*</span></label>
            <Textarea
              placeholder="Berikan alasan kenapa TRF ini dikembalikan..."
              value={remarks}
              onChange={(e)=>setRemarks(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={()=>setSelectedTRF(null)}
            >
              Cancel
            </Button>
            <Button onClick={executeReviseAction}>
              Confirm Revise
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ApprovalPage;