import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useTRFStore, useAuthStore } from '@/store';
import { gaProcessTRF } from '@/store/supabaseStore'; // gaProcessTRF tetap dipertahankan untuk update status workflow
import type { TRF } from '@/types';
import {
  Plane,
  Eye,
  CheckCircle,
  FileText,
  User,
  Calendar,
  MapPin,
  Hotel,
  Ticket,
  Car,
  Ship,
  Send,
  Loader2
} from 'lucide-react';
import { toast } from 'sonner';
// ✅ REVISI: Import supabase untuk upload file langsung
import { supabase } from '@/lib/supabase';

const ProcessPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { getTRFsForProcessing, fetchAllData } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  // ✅ REVISI: State baru sesuai instruksi Maha Raja
  const [documents, setDocuments] = useState<Record<string, {name: string, url: string}>>({});
  const [groundInfo, setGroundInfo] = useState('');
  const [remarksToEmployee, setRemarksToEmployee] = useState('');

  const trfsForProcessing = getTRFsForProcessing();

  const handleProcessClick = (trf: TRF) => {
    setSelectedTRF(trf);
    setDocuments((trf as any).gaDocuments || {});
    setGroundInfo((trf as any).gaDocuments?.groundInfo || '');
    setRemarksToEmployee('');
    setProcessDialogOpen(true);
  };

  // ✅ REVISI: Fungsi Upload Handler
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: string) => {
    const file = e.target.files?.[0];
    if (!file || !selectedTRF) return;

    setIsUploading(true);
    toast.info(`Uploading ${type}...`);

    try {
      const path = `${selectedTRF.id}/${type}-${Date.now()}-${file.name}`;

      const { error } = await supabase.storage
        .from("trf-documents")
        .upload(path, file);

      if (error) throw error;

      const { data } = supabase.storage
        .from("trf-documents")
        .getPublicUrl(path);

      setDocuments(prev => ({
        ...prev,
        [type]: {
          name: file.name,
          url: data.publicUrl
        }
      }));
      
      toast.success(`${type} uploaded successfully!`);
    } catch (err) {
      console.error(err);
      toast.error(`Failed to upload ${type}`);
    } finally {
      setIsUploading(false);
      // Reset input agar bisa upload file yang sama jika salah
      e.target.value = '';
    }
  };

  const confirmProcess = async () => {
    if (!selectedTRF || !currentUser) return;

    try {
      // ✅ REVISI: Save dokumen ke kolom ga_documents di tabel trfs
      const { error } = await supabase
        .from("trfs")
        .update({
          gaDocuments: {
            ...documents,
            groundInfo
          }
        })
        .eq("id", selectedTRF.id);

      if (error) throw error;

      // Tetap jalankan fungsi ini untuk mengubah status TRF menjadi GA_PROCESSED & catat history
      await gaProcessTRF(
        selectedTRF.id,
        currentUser.id,
        currentUser.username,
        {}, // voucher lama dikosongkan karena sudah pindah ke ga_documents
        remarksToEmployee
      );

      await fetchAllData();
      toast.success(`TRF ${selectedTRF.trfNumber} processed successfully`);
      setProcessDialogOpen(false);
      setSelectedTRF(null);
    } catch (error) {
      console.error(error);
      toast.error('Failed to process TRF');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header & Stats & TRF List Render (Bagian ini sama seperti aslinya) */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Process TRFs</h1>
        <p className="text-gray-500 mt-1">Issue vouchers and tickets for approved travel requests</p>
      </div>

      <div className="flex gap-4">
        <Card className="flex-1 bg-green-50 border-green-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <Plane className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-900">{trfsForProcessing.length}</p>
              <p className="text-sm text-green-700">Ready to Process</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {trfsForProcessing.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No TRFs to Process</h3>
            <p className="text-gray-500 mt-1">All approved TRFs have been processed</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {trfsForProcessing.map((trf) => (
            <Card key={trf.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900">{trf.trfNumber}</h3>
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        PM APPROVED
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Requestor</p>
                          <p className="text-sm font-medium text-gray-900">{trf.employee?.employeeName}</p>
                          <p className="text-xs text-gray-400">{trf.department}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Travel Dates</p>
                          <p className="text-sm font-medium text-gray-900">
                            {formatDate(trf.startDate)} - {formatDate(trf.endDate)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Purpose</p>
                          <p className="text-sm font-medium text-gray-900">{trf.travelPurpose}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button variant="outline" size="sm" onClick={() => navigate(`/trf/${trf.id}`)}>
                      <Eye className="w-4 h-4 mr-1" /> View
                    </Button>
                    <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => handleProcessClick(trf)}>
                      <Plane className="w-4 h-4 mr-1" /> Process
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Process Dialog */}
      <Dialog open={processDialogOpen} onOpenChange={setProcessDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plane className="w-5 h-5 text-green-600" />
              Process TRF {selectedTRF?.trfNumber}
            </DialogTitle>
            <DialogDescription>
              Upload documents and vouchers for this travel request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            
            {/* ✅ REVISI: Hotel Voucher File Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2"><Hotel className="w-4 h-4 text-blue-600" /> Hotel Voucher</span>
                {documents.hotelVoucher && <span className="text-xs text-green-600 font-semibold">✅ Uploaded</span>}
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleUpload(e, "hotelVoucher")}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border rounded-md p-1"
              />
            </div>

            {/* ✅ REVISI: Flight Ticket File Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2"><Ticket className="w-4 h-4 text-green-600" /> Flight Ticket</span>
                {documents.flightTicket && <span className="text-xs text-green-600 font-semibold">✅ Uploaded</span>}
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleUpload(e, "flightTicket")}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 cursor-pointer border rounded-md p-1"
              />
            </div>

            {/* ✅ REVISI: Ship Ticket File Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center justify-between">
                <span className="flex items-center gap-2"><Ship className="w-4 h-4 text-cyan-600" /> Ship Ticket</span>
                {documents.shipTicket && <span className="text-xs text-green-600 font-semibold">✅ Uploaded</span>}
              </label>
              <input
                type="file"
                accept=".pdf,image/*"
                onChange={(e) => handleUpload(e, "shipTicket")}
                disabled={isUploading}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-cyan-50 file:text-cyan-700 hover:file:bg-cyan-100 cursor-pointer border rounded-md p-1"
              />
            </div>

            {/* ✅ REVISI: Ground Info Textarea */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Car className="w-4 h-4 text-orange-600" />
                Ground Transportation Details
              </label>
              <Textarea
                placeholder="e.g., Driver Budi will pickup at 08:00 AM"
                value={groundInfo}
                onChange={(e) => setGroundInfo(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Remarks to Employee */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Send className="w-4 h-4 text-indigo-600" />
                Message to Employee
              </label>
              <Textarea
                placeholder="Instructions for the employee regarding ticket collection, check-in, etc."
                value={remarksToEmployee}
                onChange={(e) => setRemarksToEmployee(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setProcessDialogOpen(false)} className="flex-1" disabled={isUploading}>
              Cancel
            </Button>
            <Button onClick={confirmProcess} className="flex-1 bg-green-600 hover:bg-green-700" disabled={isUploading}>
              {isUploading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <CheckCircle className="w-4 h-4 mr-2" />}
              Complete Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProcessPage;