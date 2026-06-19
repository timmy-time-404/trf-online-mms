import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import EmployeeInfoSection from './components/EmployeeInfoSection';
import TravelPurposeSection, { createEmptyPurposeEntry } from './components/TravelPurposeSection';
import AccommodationSection, { createEmptyAccommodationEntry } from './components/AccommodationSection';
import type { AccommodationEntry } from './components/AccommodationSection';
import TravelArrangementSection from './components/TravelArrangementSection';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore, useAuthStore } from '@/store';
import type { UpdateTRFInput, TravelArrangement, TravelPurposeEntry } from '@/types';
import { Send, ArrowLeft, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

const TRFEditPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { currentUser } = useAuthStore();
  const { getTRFById, resubmitTRF, fetchAllData } = useTRFStore();

  const trf = id ? getTRFById(id) : undefined;

  const [purposeEntries, setPurposeEntries] = useState<TravelPurposeEntry[]>([
    createEmptyPurposeEntry(),
  ]);

  const [accommodationEntries, setAccommodationEntries] = useState<AccommodationEntry[]>([]);

  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([]);

  const [isLoaded, setIsLoaded] = useState(false);
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const isEditable = trf.status === 'DRAFT' || trf.status === 'NEEDS_REVISION';

  if (!isEditable) {
    return (
      <div className="max-w-2xl mx-auto text-center py-16">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-900">TRF ini tidak dapat diedit</h2>
        <p className="text-gray-500 mt-2">
          Status saat ini: <span className="font-medium">{trf.status}</span>. Hanya TRF dengan
          status Draft atau Needs Revision yang dapat diedit.
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
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !currentUser || !trf) return;

    setIsSubmitting(true);
    try {
      const input = buildUpdateInput();
      const success = await resubmitTRF(trf.id, currentUser.id, currentUser.username, input);

      if (!success) throw new Error('Gagal resubmit TRF');

      await fetchAllData();
      toast.success('TRF berhasil diperbarui dan dikirim ulang untuk verifikasi');
      navigate(`/trf/${trf.id}`);
    } catch {
      toast.error('Gagal mengirim ulang TRF');
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

        <h1 className="text-2xl font-bold text-gray-900">Edit Travel Request</h1>

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
      </div>

      <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={() => navigate(`/trf/${trf.id}`)}>
          Cancel
        </Button>

        <Button onClick={() => setSubmitDialogOpen(true)} disabled={isSubmitting}>
          <Send className="w-4 h-4 mr-2" />
          Resubmit TRF
        </Button>
      </div>

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="Confirm Resubmission"
        description="Apakah kamu yakin ingin mengirim ulang TRF ini untuk diverifikasi?"
        onConfirm={handleSubmit}
        confirmText="Resubmit"
        cancelText="Cancel"
        variant="warning"
        loading={isSubmitting}
      />
    </div>
  );
};

export default TRFEditPage;