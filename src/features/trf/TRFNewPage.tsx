import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import EmployeeInfoSection from './components/EmployeeInfoSection';
import TravelPurposeSection from './components/TravelPurposeSection';
import AccommodationSection from './components/AccommodationSection';
import TravelArrangementSection from './components/TravelArrangementSection';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore, useAuthStore } from '@/store';
import type { CreateTRFInput, Accommodation, TravelArrangement } from '@/types';
import { Save, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
// ✅ Tambahkan import supabase


const TRFNewPage: React.FC = () => {
  const navigate = useNavigate();
  
  // ✅ Panggil currentUser dari Zustand Store
  const { currentUser } = useAuthStore();
  // ✅ REVISI: Tambahkan employees dari store
  const { createTRF, submitTRF, fetchAllData, employees } = useTRFStore();

  // ✅ REVISI: Initial state kosong, di-handle oleh useEffect di bawah
  const [formData, setFormData] = useState<CreateTRFInput>({
  employeeId: '',
  department: '',
  travelPurpose: '',
  startDate: '',
  endDate: '',
  purposeRemarks: '',
  accommodation: {
    hotelName: '',
    checkInDate: '',
    checkOutDate: '',
    remarks: ''
  },
  travelArrangements: []
});

  const [submitDialogOpen, setSubmitDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ REVISI: Mencari data employee berdasarkan userId dan auto-fill form
  useEffect(() => {
    if (currentUser?.role === "EMPLOYEE") {
      const emp = employees.find(e => e.userId === currentUser.id);

      if (emp) {
        setFormData(prev => ({
          ...prev,
          employeeId: emp.id,
          department: emp.department
        }));
      }
    }
  }, [currentUser, employees]);

  /* ================= HANDLERS ================= */
  const handleEmployeeChange = (employeeId: string) => {
    setFormData(prev => ({
      ...prev,
      employeeId
    }));
  };

  const handlePurposeChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAccommodationChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      accommodation: {
        ...prev.accommodation,
        [field]: value
      } as Accommodation
    }));
  };

  const handleArrangementsChange = (arrangements: TravelArrangement[]) => {
    setFormData(prev => ({ ...prev, travelArrangements: arrangements }));
  };

  /* ================= DOWNLOAD FUNCTION ================= */
  

  /* ================= VALIDATION ================= */
  const validateForm = (): boolean => {
    if (!formData.employeeId) {
      toast.error('Akun employee tidak tertaut dengan sistem.');
      return false;
    }
    if (!formData.travelPurpose) {
      toast.error('Harap pilih tujuan perjalanan (Travel Purpose).');
      return false;
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error('Harap pilih tanggal mulai dan selesai perjalanan.');
      return false;
    }
    return true;
  };

  /* ================= SAVE DRAFT ================= */
  const handleSaveDraft = async () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      await fetchAllData();
      const newTRF = await createTRF(formData);

      if (!newTRF) throw new Error("Gagal membuat data");

      toast.success('TRF saved as draft');
      navigate(`/trf/${newTRF.id}`);
    } catch {
      toast.error('Failed to save TRF draft');
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (!validateForm() || !currentUser) return;

    setIsSubmitting(true);
    try {
      const newTRF = await createTRF(formData);

      if (!newTRF) throw new Error("Gagal membuat data");

      // Melakukan submit dan mengubah status
      await submitTRF(
        newTRF.id,
        currentUser.id,
        currentUser.username
      );

      // reload data dari Supabase
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

  /* ================= UI ================= */
  

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
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

          <h1 className="text-2xl font-bold text-gray-900">
            New Travel Request
          </h1>

          <p className="text-gray-500 mt-1">
            Create a new travel request form
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <EmployeeInfoSection
          selectedEmployeeId={formData.employeeId || ''}
          onEmployeeChange={handleEmployeeChange}
        />
        <TravelPurposeSection
          purpose={formData.travelPurpose || ''}
          startDate={formData.startDate || ''}
          endDate={formData.endDate || ''}
          remarks={formData.purposeRemarks || ''}
          onChange={handlePurposeChange}
        />
        <AccommodationSection
          hotelName={formData.accommodation?.hotelName || ''}
          checkInDate={formData.accommodation?.checkInDate || ''}
          checkOutDate={formData.accommodation?.checkOutDate || ''}
          remarks={formData.accommodation?.remarks || ''}
          onChange={handleAccommodationChange}
        />
        <TravelArrangementSection
          arrangements={formData.travelArrangements || []}
          onChange={handleArrangementsChange}
        />

        
      </div>

      <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
        <Button variant="outline" onClick={() => navigate('/trf')}>
          Cancel
        </Button>

        <Button variant="secondary" onClick={handleSaveDraft}>
          <Save className="w-4 h-4 mr-2" />
          Save as Draft
        </Button>

        <Button onClick={() => setSubmitDialogOpen(true)}>
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