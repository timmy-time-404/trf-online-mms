import React, { useState,useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TRFDetailView from './components/TRFDetailView';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore } from '@/store';
import { toast } from 'sonner';

const TRFDetailPage: React.FC = () => {
  
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTRFById, deleteTRF, fetchAllData } = useTRFStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  useEffect(() => {
  fetchAllData();
}, []);

  const trf = id ? getTRFById(id) : undefined;  
  
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

  const handleEdit = () => {
    navigate(`/trf/${trf.id}/edit`);
  };

  const handleDelete = () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    deleteTRF(trf.id);
    toast.success('TRF deleted successfully');
    navigate('/trf');
  };
  
  

  return (
    <div>
      <TRFDetailView
        trf={trf}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete TRF"
        description={`Are you sure you want to delete ${trf.trfNumber}? This action cannot be undone.`}
        onConfirm={confirmDelete}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default TRFDetailPage;
