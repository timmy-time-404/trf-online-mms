import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import EmployeeInfoSection from './components/EmployeeInfoSection';
import TravelPurposeSection from './components/TravelPurposeSection';
import AccommodationSection from './components/AccommodationSection';
import TravelArrangementSection from './components/TravelArrangementSection';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore, useAuthStore } from '@/store';
import type { TRF, Accommodation, TravelArrangement } from '@/types';
import { Save, Send, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';

const TRFNewPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { createTRF, submitTRF } = useTRFStore();

  const [formData, setFormData] = useState<Partial<TRF>>({
    employeeId: currentUser?.employeeId || '',
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

  const handleEmployeeChange = (employeeId: string) => {
    setFormData(prev => ({ ...prev, employeeId }));
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

  const validateForm = (): boolean => {
    if (!formData.employeeId) {
      toast.error('Please select an employee');
      return false;
    }
    if (!formData.travelPurpose) {
      toast.error('Please select travel purpose');
      return false;
    }
    if (!formData.startDate || !formData.endDate) {
      toast.error('Please select travel dates');
      return false;
    }
    return true;
  };

  const handleSaveDraft = () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const newTRF = createTRF(formData as Omit<TRF, 'id' | 'trfNumber' | 'createdAt' | 'updatedAt' | 'status'>);
      toast.success('TRF saved as draft');
      navigate(`/trf/${newTRF.id}`);
    } catch (error) {
      toast.error('Failed to save TRF');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = () => {
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const newTRF = createTRF(formData as Omit<TRF, 'id' | 'trfNumber' | 'createdAt' | 'updatedAt' | 'status'>);
      submitTRF(newTRF.id);
      toast.success('TRF submitted successfully');
      navigate(`/trf/${newTRF.id}`);
    } catch (error) {
      toast.error('Failed to submit TRF');
    } finally {
      setIsSubmitting(false);
      setSubmitDialogOpen(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
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
          <h1 className="text-2xl font-bold text-gray-900">New Travel Request</h1>
          <p className="text-gray-500 mt-1">Create a new travel request form</p>
        </div>
      </div>

      {/* Form */}
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

      {/* Actions */}
      <div className="flex items-center justify-end gap-4 pt-6 border-t border-gray-200">
        <Button
          variant="outline"
          onClick={() => navigate('/trf')}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          variant="secondary"
          onClick={handleSaveDraft}
          disabled={isSubmitting}
        >
          <Save className="w-4 h-4 mr-2" />
          Save as Draft
        </Button>
        <Button
          onClick={() => setSubmitDialogOpen(true)}
          disabled={isSubmitting}
        >
          <Send className="w-4 h-4 mr-2" />
          Submit TRF
        </Button>
      </div>

      {/* Submit Confirmation */}
      <ConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="Confirm Submission"
        description="Are you sure you want to submit this TRF? Once submitted, you will not be able to edit it until it is reviewed."
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
