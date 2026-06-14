import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import EmployeeInfoSection from './components/EmployeeInfoSection';
import TravelPurposeSection, { createEmptyPurposeEntry } from './components/TravelPurposeSection';
import AccommodationSection, { createEmptyAccommodationEntry } from './components/AccommodationSection';
import type { AccommodationEntry } from './components/AccommodationSection';
import TravelArrangementSection from './components/TravelArrangementSection';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore, useAuthStore } from '@/store';
import type { CreateTRFInput, TravelArrangement, TravelPurposeEntry } from '@/types';
import { Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const TRFNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { createTRF, submitTRF, fetchAllData, employees } = useTRFStore();

  // ── State: multi-purpose entries ──────────────────────────
  const [purposeEntries, setPurposeEntries] = useState<TravelPurposeEntry[]>([
    createEmptyPurposeEntry(),
  ]);

  // ── State: multi-accommodation entries ────────────────────
  const [accommodationEntries, setAccommodationEntries] = useState<AccommodationEntry[]>([]);

  // ── State: travel arrangements (sudah multi dari sebelumnya) ─
  const [travelArrangements, setTravelArrangements] = useState<TravelArrangement[]>([]);

  // ── State: employee ID ────────────────────────────────────
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment]  = useState('');

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting]         = useState(false);

  // ── Auto-fill employee untuk role EMPLOYEE ────────────────
  useEffect(() => {
    if (currentUser?.role === 'EMPLOYEE') {
      const emp = employees.find(e => e.userId === currentUser.id);
      if (emp) {
        setEmployeeId(emp.id);
        setDepartment(emp.department);
      }
    }
  }, [currentUser, employees]);

  // ── Build CreateTRFInput dari state ───────────────────────
  // Field lama diisi dari entry pertama untuk backward-compat dengan store.
  const buildCreateInput = (): CreateTRFInput => {
    const firstPurpose = purposeEntries[0];
    const firstAccom   = accommodationEntries[0];

    return {
      employeeId,
      department,

      // Backward-compat: single fields dari entry pertama
      travelPurpose : firstPurpose?.travelPurpose ?? '',
      startDate     : firstPurpose?.startDate     ?? '',
      endDate       : firstPurpose?.endDate       ?? '',
      purposeRemarks: firstPurpose?.purposeRemarks ?? '',

      // Multi entries (untuk PDF)
      purposeEntries  : purposeEntries,
      accommodations  : accommodationEntries.map(({ _id, ...rest }) => rest),

      // Backward-compat: single accommodation
      accommodation: firstAccom
        ? {
            hotelName   : firstAccom.hotelName,
            checkInDate : firstAccom.checkInDate,
            checkOutDate: firstAccom.checkOutDate,
            remarks     : firstAccom.remarks,
          }
        : undefined,

      travelArrangements,
    };
  };

  // ── Validation ────────────────────────────────────────────
  const validateForm = (): boolean => {
    if (!employeeId) {
      toast.error('Akun employee tidak tertaut dengan sistem.');
      return false;
    }

    // Cek semua purpose entries
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

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!validateForm() || !currentUser) return;

    setIsSubmitting(true);
    try {
      const input  = buildCreateInput();
      const newTRF = await createTRF(input);
      if (!newTRF) throw new Error('Gagal membuat data');

      await submitTRF(newTRF.id, currentUser.id, currentUser.username);
      await fetchAllData();

      toast.success('TRF submitted successfully');
      navigate(`/trf/${newTRF.id}`);
    } catch {
      toast.error('Failed to submit TRF');
    } finally {
      setIsSubmitting(false);
      setSubmitDialogOpen(false);
    }
  };

  // ── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Page header */}
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 -ml-2 text-gray-500"
          onClick={() => navigate('/trf')}
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to List
        </Button>
        <h1 className="text-2xl font-bold text-gray-900">New Travel Request</h1>
        <p className="text-gray-500 mt-1">Create a new travel request form</p>
      </div>

      {/* Form sections */}
      <div className="space-y-6">
        <EmployeeInfoSection
          selectedEmployeeId={employeeId}
          onEmployeeChange={setEmployeeId}
        />

        {/* ── Multi Travel Purpose ── */}
        <TravelPurposeSection
          entries={purposeEntries}
          onChange={setPurposeEntries}
        />

        {/* ── Multi Accommodation ── */}
        <AccommodationSection
          entries={accommodationEntries}
          onChange={setAccommodationEntries}
        />

        {/* ── Travel Arrangement (sudah multi dari sebelumnya) ── */}
        <TravelArrangementSection
          arrangements={travelArrangements}
          onChange={setTravelArrangements}
        />
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={() => navigate('/trf')}>
          Cancel
        </Button>
        <Button onClick={() => setSubmitDialogOpen(true)} disabled={isSubmitting}>
          <Send className="w-4 h-4 mr-2" />
          Submit TRF
        </Button>
      </div>

      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="Confirm Submission"
        description="Are you sure you want to submit this TRF for approval?"
        onConfirm={handleSubmit}
        confirmText="Submit"
        cancelText="Cancel"
        variant="warning"
        loading={isSubmitting}
      />
    </div>
  );
};

export default TRFNewPage;