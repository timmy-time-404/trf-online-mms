import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import TRFDetailView from './components/TRFDetailView';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import { useTRFStore } from '@/store';
import { toast } from 'sonner';

// ✅ IMPORT COMPONENT CARD
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Banknote } from 'lucide-react';

const TRFDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getTRFById, deleteTRF, fetchAllData } = useTRFStore();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  
  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

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
  
  const gaFiles = (trf as any).ga_files;

  return (
    <div className="space-y-6">
      <TRFDetailView
        trf={trf}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {/* ✅ KOTAK LUMPSUM (TAMBAHAN MAHA RAJA) */}
      {trf.lumpsumAmount !== undefined && trf.lumpsumAmount > 0 && (
        <Card className="max-w-4xl border shadow-sm">
          <CardHeader className="bg-green-50 rounded-t-xl border-b border-green-100 pb-4">
            <div className="flex items-center gap-2">
              <Banknote className="w-5 h-5 text-green-700" />
              <CardTitle className="text-green-800 text-lg">HR Lumpsum Allowance</CardTitle>
            </div>
          </CardHeader>

          <CardContent className="pt-6">
            <div className="text-3xl font-bold text-green-600">
              Rp {trf.lumpsumAmount.toLocaleString("id-ID")}
            </div>

            {trf.lumpsumNote && (
              <div className="mt-4 p-3 bg-gray-50 border-l-4 border-green-400 rounded-r-md">
                <p className="text-xs font-medium text-gray-500 uppercase mb-1">Catatan HR:</p>
                <p className="text-sm text-gray-700 italic">
                  "{trf.lumpsumNote}"
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* UI Dokumen GA */}
      {gaFiles && gaFiles.length > 0 && (
        <div className="mt-6 border rounded-lg p-4 bg-blue-50 max-w-4xl">
          <h3 className="font-semibold mb-3 text-blue-900">
            Travel Documents (Tickets / Vouchers)
          </h3>

          <div className="flex flex-col gap-2">
            {gaFiles.map((file: any, index: number) => (
              <a
                key={index}
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors self-start hover:underline bg-white px-3 py-2 rounded-md shadow-sm border border-blue-100"
              >
                📄 Download {file.name}
              </a>
            ))}
          </div>
        </div>
      )}

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