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
import type { TRF } from '@/types';
import {
  CheckCircle,
  XCircle,
  Eye,
  FileText,
  User,
  Calendar,
  MapPin,
  AlertCircle,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const VerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { getTRFsForVerification, verifyTRF } = useTRFStore();

  const [selectedTRF, setSelectedTRF] = useState<TRF | null>(null);
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyAction, setVerifyAction] = useState<'YES' | 'NO' | null>(null);
  const [remarks, setRemarks] = useState('');

  // Get TRFs for current Admin Dept's department
  const trfsForVerification = currentUser?.department 
    ? getTRFsForVerification(currentUser.department)
    : [];

  const handleVerifyClick = (trf: TRF, action: 'YES' | 'NO') => {
    setSelectedTRF(trf);
    setVerifyAction(action);
    setRemarks('');
    setVerifyDialogOpen(true);
  };

  const confirmVerify = () => {
    if (!selectedTRF || !currentUser || !verifyAction) return;

    const verified = verifyAction === 'YES';
    
    try {
      verifyTRF(
        selectedTRF.id,
        currentUser.id,
        currentUser.username,
        verified,
        remarks
      );

      if (verified) {
        toast.success(`TRF ${selectedTRF.trfNumber} verified successfully`);
      } else {
        toast.error(`TRF ${selectedTRF.trfNumber} returned to employee`);
      }

      setVerifyDialogOpen(false);
      setSelectedTRF(null);
      setVerifyAction(null);
      setRemarks('');
    } catch (error) {
      toast.error('Failed to verify TRF');
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Verify TRFs</h1>
        <p className="text-gray-500 mt-1">
          Verify travel requests for compliance and budget availability
        </p>
      </div>

      {/* Stats */}
      <div className="flex gap-4">
        <Card className="flex-1 bg-purple-50 border-purple-200">
          <CardContent className="p-4 flex items-center gap-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-900">{trfsForVerification.length}</p>
              <p className="text-sm text-purple-700">Pending Verification</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Department Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="font-medium text-blue-900">Department: {currentUser?.department}</p>
          <p className="text-sm text-blue-700 mt-1">
            You can only verify TRFs from your department. Check dates, budget, and policy compliance.
          </p>
        </div>
      </div>

      {/* TRF List */}
      {trfsForVerification.length === 0 ? (
        <Card className="border shadow-sm">
          <CardContent className="p-12 text-center">
            <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900">No TRFs to Verify</h3>
            <p className="text-gray-500 mt-1">All travel requests have been verified</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {trfsForVerification.map((trf) => (
            <Card key={trf.id} className="border shadow-sm hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="w-5 h-5 text-gray-400" />
                      <h3 className="text-lg font-semibold text-gray-900">{trf.trfNumber}</h3>
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                        SUBMITTED
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <div>
                          <p className="text-xs text-gray-500">Requestor</p>
                          <p className="text-sm font-medium text-gray-900">{trf.employee?.employeeName}</p>
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

                    {trf.purposeRemarks && (
                      <div className="p-3 bg-gray-50 rounded-lg mb-3">
                        <p className="text-xs text-gray-500">Remarks</p>
                        <p className="text-sm text-gray-700">{trf.purposeRemarks}</p>
                      </div>
                    )}

                    <p className="text-sm text-gray-500">
                      Submitted on {formatDate(trf.submittedAt)}
                    </p>
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
                      variant="outline"
                      size="sm"
                      className="text-green-600 border-green-200 hover:bg-green-50"
                      onClick={() => handleVerifyClick(trf, 'YES')}
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Verify Yes
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => handleVerifyClick(trf, 'NO')}
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Verify No
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Verify Dialog */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="gap-4">
            <div className={cn(
              "w-12 h-12 rounded-full flex items-center justify-center mx-auto",
              verifyAction === 'YES' ? "bg-green-100" : "bg-red-100"
            )}>
              {verifyAction === 'YES' ? (
                <CheckCircle className="w-6 h-6 text-green-600" />
              ) : (
                <XCircle className="w-6 h-6 text-red-600" />
              )}
            </div>
            <DialogTitle className="text-center text-xl">
              {verifyAction === 'YES' ? 'Verify TRF' : 'Return to Employee'}
            </DialogTitle>
            <DialogDescription className="text-center text-base">
              {verifyAction === 'YES' 
                ? `Verify ${selectedTRF?.trfNumber} and send to approval process?`
                : `Return ${selectedTRF?.trfNumber} to employee for revision?`
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              Remarks {verifyAction === 'NO' && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              placeholder={verifyAction === 'YES' 
                ? "Add any comments (optional)..." 
                : "Explain why this TRF cannot be verified..."
              }
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={3}
              className="resize-none"
              required={verifyAction === 'NO'}
            />
          </div>

          <DialogFooter className="gap-3 sm:gap-0 mt-4">
            <Button
              variant="outline"
              onClick={() => setVerifyDialogOpen(false)}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmVerify}
              className={cn(
                "flex-1",
                verifyAction === 'YES' 
                  ? "bg-green-600 hover:bg-green-700" 
                  : "bg-red-600 hover:bg-red-700"
              )}
              disabled={verifyAction === 'NO' && !remarks.trim()}
            >
              {verifyAction === 'YES' ? 'Verify Yes' : 'Verify No'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VerifyPage;