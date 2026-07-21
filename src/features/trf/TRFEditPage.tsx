import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import EmployeeInfoSection from './components/EmployeeInfoSection';
import TravelPurposeSection, { createEmptyPurposeEntry } from './components/TravelPurposeSection';
import AccommodationSection, { createEmptyAccommodationEntry } from './components/AccommodationSection';
import type { AccommodationEntry } from './components/AccommodationSection';
import TravelArrangementSection from './components/TravelArrangementSection';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore, useAuthStore } from '@/store';
import { saveHRLumpsum } from '@/store/supabaseStore';
import type { UpdateTRFInput, TravelArrangement, TravelPurposeEntry } from '@/types';
import { Send, ArrowLeft, AlertTriangle, MessageSquare, CheckCircle2, Banknote } from 'lucide-react';
import { toast } from 'sonner';

const TRFEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuthStore();
  const { getTRFById, resubmitTRF, editAndApproveTRF, fetchAllData } = useTRFStore();

  const trf = id ? getTRFById(id) : undefined;

  const [purposeEntries, setPurposeEntries] = useState<TravelPurposeEntry[]>([
    createEmptyPurposeEntry(),
  ]);

  const [accommodationEntries, setAccommodationEntries] = useState<AccommodationEntry[]>([]);

  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [noteToEmployee, setNoteToEmployee] = useState('');
  const [lumpsum, setLumpsum] = useState<number | ''>('');
  const [lumpsumNote, setLumpsumNote] = useState('');

  const isHREditApprove =
    currentUser?.role === 'HR' && trf?.status === 'HOD_APPROVED';
  const isGAEditOnly =
    currentUser?.role === 'GA' && trf?.status === 'PM_APPROVED';
  const isEditApproveMode = isHREditApprove || isGAEditOnly;

  useEffect(() => {
    if (!trf || isLoaded) return;

    const existingPurposeEntries = (trf as any).purposeEntries;
    if (Array.isArray(existingPurposeEntries) && existingPurposeEntries.length > 0) {
      setPurposeEntries(existingPurposeEntries);
    } else {
      setPurposeEntries([
        {
          id: 'legacy',
          travelPurpose: trf.travelPurpose ?? '',
          startDate: trf.startDate ?? '',
          endDate: trf.endDate ?? '',
          purposeRemarks: trf.purposeRemarks ?? '',
        },
      ]);
    }

    const existingAccommodations = (trf as any).accommodations;
    if (Array.isArray(existingAccommodations) && existingAccommodations.length > 0) {
      setAccommodationEntries(
        existingAccommodations.map((a: any) => ({
          _id: `accom-${Math.random().toString(36).slice(2, 9)}`,
          hotelName: a.hotelName ?? '',
          checkInDate: a.checkInDate ?? '',
          checkOutDate: a.checkOutDate ?? '',
          remarks: a.remarks ?? '',
        })),
      );
    } else if (trf.accommodation) {
      setAccommodationEntries([
        {
          _id: `accom-${Math.random().toString(36).slice(2, 9)}`,
          hotelName: trf.accommodation.hotelName ?? '',
          checkInDate: trf.accommodation.checkInDate ?? '',
          checkOutDate: trf.accommodation.checkOutDate ?? '',
          remarks: trf.accommodation.remarks ?? '',
        },
      ]);
    } else {
      setAccommodationEntries([]);
    }

    setTravelArrangements(trf.travelArrangements ?? []);
    setIsLoaded(true);
  }, [trf, isLoaded]);

  if (!trf) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-semibold text-gray-900">Loading TRF...</h2>
        <p className="text-gray-500 mt-2">Fetching latest data....</p>
        <button
          onClick={() => navigate('/trf')}
          className="mt-4 text-blue-600 hover:text-blue-700"
        >
          Back to TRF List
        </button>
      </div>
    );
  }

  const isEmployeeEditableStatus = trf.status === 'DRAFT' || trf.status === 'NEEDS_REVISION';
  const isEditable = isEmployeeEditableStatus || isEditApproveMode;

  if (!isEditable) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">TRF ini tidak dapat diedit</h2>
        <p className="text-gray-500 mt-2">
          Status saat ini: <span className="font-medium">{trf.status}</span>.{' '}
          {currentUser?.role === 'HR' &&
            'HR hanya dapat mengedit TRF dengan status HOD Approved.'}
          {currentUser?.role === 'GA' &&
            'GA hanya dapat mengedit TRF dengan status PM Approved.'}
          {currentUser?.role !== 'HR' &&
            currentUser?.role !== 'GA' &&
            'Hanya TRF dengan status Draft atau Needs Revision yang dapat diedit.'}
        </p>
        <Button className="mt-6" variant="outline" onClick={() => navigate(`/trf/${trf.id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Detail
        </Button>
      </div>
    );
  }

  const buildUpdateInput = (): UpdateTRFInput => {
    const firstPurpose = purposeEntries[0];
    const firstAccom = accommodationEntries[0];

    return {
      travelPurpose: firstPurpose?.travelPurpose ?? '',
      startDate: firstPurpose?.startDate ?? '',
      endDate: firstPurpose?.endDate ?? '',
      purposeRemarks: firstPurpose?.purposeRemarks ?? '',

      purposeEntries,
      accommodations: accommodationEntries.map(({ _id, ...rest }) => rest),

      accommodation: firstAccom
        ? {
            hotelName: firstAccom.hotelName,
            checkInDate: firstAccom.checkInDate,
            checkOutDate: firstAccom.checkOutDate,
            remarks: firstAccom.remarks,
          }
        : undefined,

      travelArrangements,
    };
  };

  const validateForm = (): boolean => {
    for (let i = 0; i < purposeEntries.length; i++) {
      const p = purposeEntries[i];
      if (!p.travelPurpose) {
        toast.error(`Travel Purpose #${i + 1}: Harap pilih tujuan perjalanan.`);
        return false;
      }
      if (!p.startDate || !p.endDate) {
        toast.error(`Travel Purpose #${i + 1}: Harap isi tanggal mulai dan selesai.`);
        return false;
      }
    }

    if (isEditApproveMode && !noteToEmployee.trim()) {
      toast.error('Catatan untuk employee wajib diisi sebelum menyimpan & approve.');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !currentUser || !trf) return;

    setIsSubmitting(true);
    try {
      const input = buildUpdateInput();

      if (isEditApproveMode) {
        // Sama seperti alur Approve biasa di ApprovalPage: HR wajib
        // menyimpan lumpsum dulu sebelum TRF disetujui.
        if (isHREditApprove) {
          try {
            await saveHRLumpsum(trf.id, Number(lumpsum) || 0, lumpsumNote, currentUser.id);
          } catch {
            toast.error('Gagal menyimpan data Lumpsum.');
            setIsSubmitting(false);
            setSubmitDialogOpen(false);
            return;
          }
        }

        const success = await editAndApproveTRF(trf.id, currentUser, input, noteToEmployee);
        if (!success) throw new Error('Gagal menyimpan perubahan TRF');

        await fetchAllData();

        if (isGAEditOnly) {
          // GA TIDAK auto-approve: TRF masih PM_APPROVED, GA tetap harus
          // upload dokumen lewat halaman Process untuk menyelesaikannya.
          toast.success(
            'Perubahan TRF tersimpan. TRF ini belum disetujui silakan lanjut upload dokumen di halaman Process.',
          );
          navigate('/process');
        } else {
          toast.success(
            'TRF berhasil diperbarui dan disetujui. Notifikasi telah dikirim ke employee.',
          );
          navigate(`/trf/${trf.id}`);
        }
        return;
      }

      const success = await resubmitTRF(trf.id, currentUser.id, currentUser.username, input);

      if (!success) throw new Error('Gagal resubmit TRF');

      await fetchAllData();
      toast.success('TRF berhasil diperbarui dan dikirim ulang untuk verifikasi');
      navigate(`/trf/${trf.id}`);
    } catch {
      toast.error(isEditApproveMode ? 'Gagal menyimpan perubahan TRF' : 'Gagal mengirim ulang TRF');
    } finally {
      setIsSubmitting(false);
      setSubmitDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-gray-500"
          onClick={() => navigate(`/trf/${trf.id}`)}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Detail
        </Button>

        <h1 className="text-2xl font-bold text-gray-900">
          {isHREditApprove
            ? 'Edit & Approve Travel Request'
            : isGAEditOnly
              ? 'Edit Travel Request (GA)'
              : 'Edit Travel Request'}
        </h1>

        <p className="text-gray-500 mt-1">
          {trf.trfNumber} &middot; Status: <span className="font-medium">{trf.status}</span>
        </p>

        {trf.status === 'NEEDS_REVISION' && (
          <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />

            <div>
              <p className="text-sm font-medium text-amber-900">
                TRF ini dikembalikan untuk revisi
              </p>

              {trf.adminDeptVerify?.remarks && (
                <p className="text-sm text-amber-800 mt-1">
                  Catatan: "{trf.adminDeptVerify.remarks}"
                </p>
              )}
            </div>
          </div>
        )}

        {isEditApproveMode && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">
                {isHREditApprove ? 'Mode Edit & Approve (HR)' : 'Mode Edit (GA)'}
              </p>
              <p className="text-sm text-blue-800 mt-1">
                {isHREditApprove
                  ? 'Perubahan yang kamu simpan di sini akan langsung menyetujui TRF ini (status akan maju ke tahap berikutnya) dan employee akan mendapat notifikasi berisi catatan yang kamu tulis di bawah.'
                  : 'Perubahan yang kamu simpan di sini TIDAK langsung menyetujui TRF ini. Employee akan mendapat notifikasi bahwa TRF-nya diedit, tapi kamu tetap harus upload dokumen (voucher/tiket) di halaman Process untuk benar-benar menyelesaikan TRF ini.'}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <EmployeeInfoSection selectedEmployeeId={trf.employeeId} disabled />

        <TravelPurposeSection entries={purposeEntries} onChange={setPurposeEntries} />

        <AccommodationSection
          entries={accommodationEntries}
          onChange={setAccommodationEntries}
        />

        <TravelArrangementSection
          arrangements={travelArrangements}
          onChange={setTravelArrangements}
        />

        {isHREditApprove && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
            <label className="text-sm font-medium flex items-center gap-2 text-gray-900">
              <Banknote className="w-4 h-4 text-green-600" />
              Lumpsum
            </label>
            <div>
              <label className="text-xs text-gray-500">Nominal Lumpsum (Rp)</label>
              <input
                type="number"
                min={0}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={lumpsum}
                onChange={(e) => setLumpsum(e.target.value ? Number(e.target.value) : '')}
                placeholder="0"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500">Catatan Lumpsum (opsional)</label>
              <Textarea
                placeholder="Tambahkan catatan terkait lumpsum..."
                value={lumpsumNote}
                onChange={(e) => setLumpsumNote(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        {isEditApproveMode && (
          <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-2">
            <label className="text-sm font-medium flex items-center gap-2 text-gray-900">
              <MessageSquare className="w-4 h-4 text-blue-600" />
              Catatan untuk Employee <span className="text-red-500">*</span>
            </label>
            <p className="text-xs text-gray-500">
              Catatan ini akan dikirim sebagai notifikasi ke employee saat kamu menyimpan
              perubahan.
            </p>
            <Textarea
              placeholder={
                isHREditApprove
                  ? 'Contoh: Tanggal keberangkatan disesuaikan mengikuti jadwal HOD, mohon dicek kembali.'
                  : 'Contoh: Tiket & akomodasi sudah kami sesuaikan, dokumen menyusul setelah diproses.'
              }
              value={noteToEmployee}
              onChange={(e) => setNoteToEmployee(e.target.value)}
              rows={4}
            />
          </div>
        )}
      </div>

      <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={() => navigate(`/trf/${trf.id}`)}>
          Cancel
        </Button>

        <Button
          onClick={() => setSubmitDialogOpen(true)}
          disabled={isSubmitting}
          className={isEditApproveMode ? 'bg-green-600 hover:bg-green-700' : ''}
        >
          {isHREditApprove ? (
            <>
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Simpan & Approve
            </>
          ) : isGAEditOnly ? (
            <>
              <Send className="w-4 h-4 mr-2" />
              Simpan Perubahan
            </>
          ) : (
            <>
              <Send className="w-4 h-4 mr-2" />
              Resubmit TRF
            </>
          )}
        </Button>
      </div>

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title={
          isHREditApprove
            ? 'Konfirmasi Simpan & Approve'
            : isGAEditOnly
              ? 'Konfirmasi Simpan Perubahan'
              : 'Confirm Resubmission'
        }
        description={
          isHREditApprove
            ? 'Perubahan akan disimpan, TRF akan langsung disetujui ke tahap berikutnya, dan notifikasi berisi catatanmu akan dikirim ke employee. Lanjutkan?'
            : isGAEditOnly
              ? 'Perubahan akan disimpan dan employee akan mendapat notifikasi. TRF ini BELUM disetujui kamu akan diarahkan ke halaman Process untuk upload dokumen. Lanjutkan?'
              : 'Apakah kamu yakin ingin mengirim ulang TRF ini untuk diverifikasi?'
        }
        onConfirm={handleSubmit}
        confirmText={isHREditApprove ? 'Simpan & Approve' : isGAEditOnly ? 'Simpan Perubahan' : 'Resubmit'}
        cancelText="Cancel"
        variant="warning"
        loading={isSubmitting}
      />
    </div>
  );
};

export default TRFEditPage;