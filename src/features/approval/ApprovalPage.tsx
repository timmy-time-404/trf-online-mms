import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input'; // ✅ TAMBAHKAN IMPORT INPUT
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

import { useTRFStore, useAuthStore } from '@/store';
// ✅ IMPORT FUNGSI LUMPSUM DARI SUPABASE STORE
import { saveHRLumpsum } from '@/store/supabaseStore'; 
import type { TRF, UserRole } from '@/types';

import {
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  Banknote
} from 'lucide-react';

import { toast } from 'sonner';

const ApprovalPage: React.FC = () => {

  const navigate = useNavigate();
  const { currentUser } = useAuthStore();

  const {
    getTRFsForApproval,
    fetchTRFs,
    handleApproval 
  } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [remarks, setRemarks] = useState('');
  const [action, setAction] = useState<'APPROVE' | 'REVISE' | null>(null);
  
  // ✅ STATE UNTUK LUMPSUM
  const [lumpsum, setLumpsum] = useState<number | ''>('');
  const [lumpsumNote, setLumpsumNote] = useState("");

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
     ACTION HANDLERS
  ========================================================= */

  const openDialog = (trf: TRF, act: 'APPROVE' | 'REVISE') => {
    setSelectedTRF(trf);
    setAction(act);
    setRemarks('');
    setLumpsum('');
    setLumpsumNote('');
  };

  const executeAction = async () => {
    if (!selectedTRF || !currentUser || !action) return;

    if (action === 'REVISE' && !remarks.trim()) {
      toast.error('Remarks wajib diisi untuk revisi');
      return;
    }

    // ✅ JIKA ACTION APPROVE DAN ROLE ADALAH HR -> SIMPAN LUMPSUM DULU
    if (action === 'APPROVE' && userRole === 'HR') {
      try {
        await saveHRLumpsum(
          selectedTRF.id,
          Number(lumpsum) || 0,
          lumpsumNote,
          currentUser.id
        );
      } catch{
        toast.error('Gagal menyimpan data Lumpsum.');
        return;
      }
    }

    // Panggil fungsi workflow utama
    const success = await handleApproval(selectedTRF.id, currentUser, action, remarks);
    
    if (success) {
       toast.success(`TRF ${selectedTRF.trfNumber} berhasil di-${action.toLowerCase()}.`);
    } else {
       toast.error(`Gagal memproses TRF ${selectedTRF.trfNumber}.`);
    }
    
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

                {/* Tombol Approve */}
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={async () => {
                    if (!currentUser) return;
                    
                    // ✅ Jika role HR, buka Modal Lumpsum. Jika bukan, langsung approve.
                    if (userRole === 'HR') {
                      openDialog(trf, 'APPROVE');
                    } else {
                      const success = await handleApproval(trf.id, currentUser, 'APPROVE');
                      if (success) {
                          toast.success(`TRF ${trf.trfNumber} !`);
                      } else {
                          toast.error('Gagal melakukan Approve.');
                      }
                    }
                  }}
                >
                  <CheckCircle className="w-4 h-4 mr-1"/>
                  Approve
                </Button>

                {/* Tombol Reject */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={async () => {
                    if (!currentUser) return;
                    
                    const success = await handleApproval(trf.id, currentUser, 'REJECT');
                    if (success) {
                         toast.error(`TRF ${trf.trfNumber} Rejected!`);
                    } else {
                         toast.error('Gagal melakukan Reject.');
                    }
                  }}
                >
                  <XCircle className="w-4 h-4 mr-1"/>
                  Reject
                </Button>

                {/* Tombol Revise */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openDialog(trf, 'REVISE')}
                >
                  <RotateCcw className="w-4 h-4 mr-1"/>
                  Revise
                </Button>

              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* ================= DIALOG MULTI-FUNGSI (REVISE & APPROVE HR) ================= */}

      <Dialog
        open={!!selectedTRF}
        onOpenChange={() => setSelectedTRF(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'REVISE' ? 'Revise Request' : 'HR Approval & Lumpsum'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            
            {/* JIKA ACTION === REVISE */}
            {action === 'REVISE' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Alasan Revisi <span className="text-red-500">*</span></label>
                <Textarea
                  placeholder="Berikan alasan kenapa TRF ini dikembalikan..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* JIKA ACTION === APPROVE (HANYA HR YANG BISA MELIHAT INI) */}
            {action === 'APPROVE' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-green-600" />
                    Nominal Lumpsum (Rp)
                  </label>
                  <Input
                    type="number"
                    placeholder="Masukkan nominal (contoh: 500000)"
                    value={lumpsum}
                    onChange={(e) => setLumpsum(e.target.value ? Number(e.target.value) : '')}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Catatan HR (Opsional)</label>
                  <Textarea
                    placeholder="Tambahkan catatan terkait lumpsum..."
                    value={lumpsumNote}
                    onChange={(e) => setLumpsumNote(e.target.value)}
                    rows={3}
                  />
                </div>
              </>
            )}

          </div>

          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedTRF(null)}
            >
              Cancel
            </Button>
            <Button 
              onClick={executeAction}
              className={action === 'APPROVE' ? "bg-green-600 hover:bg-green-700" : ""}
            >
              {action === 'REVISE' ? 'Confirm Revise' : 'Approve & Save Lumpsum'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ApprovalPage;