import { formatPurposes } from '@/features/trf/components/travelPurposeEntries';
import TRFNotice from '@/features/trf/components/TRFNotice';
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog';

import { useTRFStore, useAuthStore } from '@/store';
import {
  HR_LUMPSUM_OPTIONS,
  isHRLumpsumAmount,
} from '@/lib/lumpsumOptions';
import type { TRF, UserRole } from '@/types';

import {
  Eye,
  CheckCircle,
  XCircle,
  RotateCcw,
  FileText,
  Banknote,
  Edit
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
  const [action, setAction] = useState<'APPROVE' | 'REVISE' | 'REJECT' | null>(null);

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

  const openDialog = (trf: TRF, act: 'APPROVE' | 'REVISE' | 'REJECT') => {
    setSelectedTRF(trf);
    setAction(act);
    setRemarks('');
    setLumpsum('');
    setLumpsumNote('');
  };

  const executeAction = async () => {
    if (!selectedTRF || !currentUser || !action) return;

    if (action !== 'APPROVE' && !remarks.trim()) {
      toast.error('Remarks wajib diisi untuk revisi');
      return;
    }

    // HR wajib memilih nominal lumpsum dari daftar resmi.
    if (action === 'APPROVE' && userRole === 'HR') {
      if (
        lumpsum === '' ||
        !isHRLumpsumAmount(lumpsum)
      ) {
        toast.error(
          'Pilih nominal lumpsum sebelum melakukan approval.',
        );
        return;
      }

    }

    // Panggil fungsi workflow utama
    const success = await handleApproval(selectedTRF.id, currentUser, action, remarks,
      userRole === 'HR' && action === 'APPROVE' && lumpsum !== '' ? { amount: lumpsum, note: lumpsumNote } : undefined, selectedTRF.version);

    if (success) {
       toast.success(action === 'APPROVE'
         ? `TRF ${selectedTRF.trfNumber} berhasil disetujui.`
         : `TRF ${selectedTRF.trfNumber} berhasil di-${action.toLowerCase()}.`);
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
                    {trf.trfNumber}<TRFNotice trf={trf} />
                  </h3>
                  <Badge variant="secondary">{trf.status}</Badge>
                </div>

                <p className="text-sm font-medium text-gray-900">
                  {trf.employee?.employeeName || 'Unknown Employee'}
                </p>

                <p className="text-sm text-gray-500 mt-1">
                  {formatPurposes(trf.travelPurpose)}
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

                {/* Tombol Edit & Approve - khusus HR */}
                {userRole === 'HR' && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    onClick={() => navigate(`/trf/${trf.id}/edit`)}
                  >
                    <Edit className="w-4 h-4 mr-1"/>
                    Edit & Approve
                  </Button>
                )}

                {userRole !== 'SUPER_ADMIN' && <>
                <Button
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  // Every approval is confirmed in the dialog first: HR picks the lumpsum, HOD/PM confirm (#15).
                  onClick={() => openDialog(trf, 'APPROVE')}
                >
                  <CheckCircle className="w-4 h-4 mr-1"/>
                  Approve
                </Button>

                </>}
                {/* Tombol Reject */}
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-300 hover:bg-red-50"
                  onClick={() => openDialog(trf,'REJECT')}
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

      {/* ================= DIALOG MULTI-FUNGSI (APPROVE, REVISE, REJECT) ================= */}

      <Dialog
        open={!!selectedTRF}
        onOpenChange={() => setSelectedTRF(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === 'REJECT' ? 'Konfirmasi penolakan TRF' : action === 'REVISE' ? 'Revise Request'
                : userRole === 'HR' ? 'HR Approval & Lumpsum' : 'Konfirmasi approval TRF'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 mt-2">

            {selectedTRF && (
              <div className="rounded-md bg-gray-50 px-3 py-2 text-sm">
                <p className="font-medium text-gray-900">{selectedTRF.trfNumber}</p>
                <p className="text-gray-600">{selectedTRF.employee?.employeeName ?? '-'}</p>
              </div>
            )}

            {/* APPROVE oleh HOD/PM: catatan opsional */}
            {action === 'APPROVE' && userRole !== 'HR' && (
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="approval-remarks">Catatan (opsional)</label>
                <Textarea
                  id="approval-remarks"
                  placeholder="Catatan untuk riwayat approval..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={3}
                />
              </div>
            )}

            {/* JIKA ACTION === REVISE */}
            {action !== 'APPROVE' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">{action === 'REJECT' ? 'Alasan Penolakan' : 'Alasan Revisi'} <span className="text-red-500">*</span></label>
                <Textarea
                  placeholder="Berikan alasan kenapa TRF ini dikembalikan..."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            {/* JIKA ACTION === APPROVE (HANYA HR YANG BISA MELIHAT INI) */}
            {action === 'APPROVE' && userRole === 'HR' && (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-green-600" />
                    Nominal Lumpsum (Rp)
                  </label>
                  <Select
                    value={
                      lumpsum === ''
                        ? undefined
                        : String(lumpsum)
                    }
                    onValueChange={value =>
                      setLumpsum(Number(value))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Pilih nominal lumpsum" />
                    </SelectTrigger>

                    <SelectContent
                      position="popper"
                      className="max-h-72"
                    >
                      {HR_LUMPSUM_OPTIONS.map(
                        option => (
                          <SelectItem
                            key={option.value}
                            value={String(
                              option.value,
                            )}
                          >
                            {option.label}
                          </SelectItem>
                        ),
                      )}
                    </SelectContent>
                  </Select>

                  <p className="text-xs text-gray-500">
                    Nominal wajib dipilih dari daftar yang telah ditetapkan.
                  </p>
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
              {action === 'REJECT' ? 'Konfirmasi penolakan' : action === 'REVISE' ? 'Confirm Revise'
                : userRole === 'HR' ? 'Approve & Save Lumpsum' : 'Approve'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};

export default ApprovalPage;
