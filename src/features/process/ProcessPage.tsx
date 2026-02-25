import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import type { TRF, GAProcess } from '@/types';
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
  FilePlus,
  Send
} from 'lucide-react';
import { toast } from 'sonner';

const ProcessPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { getTRFsForProcessing, gaProcessTRF } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [processDialogOpen, setProcessDialogOpen] = useState(false);
  
  // Voucher form state
  const [hotelVoucher, setHotelVoucher] = useState('');
  const [flightTicket, setFlightTicket] = useState('');
  const [transportation, setTransportation] = useState('');
  const [otherDetails, setOtherDetails] = useState('');
  const [remarksToEmployee, setRemarksToEmployee] = useState('');
  const [files, setFiles] = useState<string[]>([]);

  const trfsForProcessing = getTRFsForProcessing();

  const handleProcessClick = (trf: TRF) => {
    setSelectedTRF(trf);
    // Reset form
    setHotelVoucher('');
    setFlightTicket('');
    setTransportation('');
    setOtherDetails('');
    setRemarksToEmployee('');
    setFiles([]);
    setProcessDialogOpen(true);
  };

  const confirmProcess = () => {
    if (!selectedTRF || !currentUser) return;

    const voucherDetails: GAProcess['voucherDetails'] = {
      hotelVoucher: hotelVoucher || undefined,
      flightTicket: flightTicket || undefined,
      transportation: transportation || undefined,
      other: otherDetails || undefined
    };

    try {
      gaProcessTRF(
        selectedTRF.id,
        currentUser.id,
        currentUser.username,
        voucherDetails,
        remarksToEmployee,
        files.length > 0 ? files : undefined
      );

      toast.success(`TRF ${selectedTRF.trfNumber} processed successfully`);
      setProcessDialogOpen(false);
      setSelectedTRF(null);
    } catch (error) {
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

  const addMockFile = () => {
    const fileNames = ['ticket.pdf', 'voucher.pdf', 'itinerary.pdf', 'receipt.pdf'];
    const randomFile = fileNames[Math.floor(Math.random() * fileNames.length)];
    setFiles([...files, randomFile]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Process TRFs</h1>
        <p className="text-gray-500 mt-1">
          Issue vouchers and tickets for approved travel requests
        </p>
      </div>

      {/* Stats */}
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

      {/* TRF List */}
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

                    {/* Show accommodation info */}
                    {trf.accommodation && (
                      <div className="p-3 bg-blue-50 rounded-lg mb-3">
                        <p className="text-xs text-blue-700 font-medium flex items-center gap-1">
                          <Hotel className="w-3 h-3" />
                          Accommodation: {trf.accommodation.hotelName}
                        </p>
                        <p className="text-xs text-blue-600">
                          {formatDate(trf.accommodation.checkInDate)} - {formatDate(trf.accommodation.checkOutDate)}
                        </p>
                      </div>
                    )}

                    {/* Show travel arrangements */}
                    {trf.travelArrangements.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {trf.travelArrangements.map((arr, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {arr.travelType}: {arr.fromLocation} → {arr.toLocation}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/trf/${trf.id}`)}
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View
                    </Button>
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700"
                      onClick={() => handleProcessClick(trf)}
                    >
                      <Plane className="w-4 h-4 mr-1" />
                      Process
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
              Issue vouchers and tickets for this travel request
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Hotel Voucher */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Hotel className="w-4 h-4 text-blue-600" />
                Hotel Voucher Details
              </label>
              <Textarea
                placeholder="e.g., Voucher #12345, Grand Mining Hotel, 2 nights, Single room"
                value={hotelVoucher}
                onChange={(e) => setHotelVoucher(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Flight Ticket */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Ticket className="w-4 h-4 text-green-600" />
                Flight Ticket Details
              </label>
              <Textarea
                placeholder="e.g., GA-123 Jakarta-Site A, 10 Mar 2024 08:00, Seat 12A"
                value={flightTicket}
                onChange={(e) => setFlightTicket(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Transportation */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <Car className="w-4 h-4 text-orange-600" />
                Ground Transportation
              </label>
              <Input
                placeholder="e.g., Airport pickup arranged, Car rental #67890"
                value={transportation}
                onChange={(e) => setTransportation(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Other Details */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Other Details</label>
              <Textarea
                placeholder="Any other arrangements or notes..."
                value={otherDetails}
                onChange={(e) => setOtherDetails(e.target.value)}
                rows={2}
                className="resize-none text-sm"
              />
            </div>

            {/* Files */}
            <div className="space-y-2">
              <label className="text-sm font-medium flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-purple-600" />
                Attachments (Mock)
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {files.map((file, idx) => (
                  <Badge key={idx} variant="secondary" className="text-xs">
                    {file}
                  </Badge>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addMockFile}
                className="text-xs"
              >
                <FilePlus className="w-3 h-3 mr-1" />
                Add Mock File
              </Button>
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
                rows={3}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter className="gap-3 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setProcessDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmProcess}
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Complete Processing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProcessPage;