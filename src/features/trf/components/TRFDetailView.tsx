import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/common/StatusBadge';
import type { TRF } from '@/types';
import {
  User,
  Target,
  Hotel,
  Plane,
  Calendar,
  ArrowLeft,
  Edit,
  Clock,
  CheckCircle,
  MapPin,
  Briefcase,
  Building,
  Phone,
  Mail,
  Shield
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TRFDetailViewProps {
  trf: TRF;
  onEdit?: () => void;
  onDelete?: () => void;
}

const TRFDetailView: React.FC<TRFDetailViewProps> = ({
  trf,
  onEdit,
  onDelete
}) => {
  const navigate = useNavigate();

  const canEdit = trf.status === 'DRAFT' || trf.status === 'REVISED';
  const canDelete = trf.status === 'DRAFT';

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const InfoRow = ({ icon: Icon, label, value }: { icon: any, label: string, value?: string }) => (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <Icon className="w-4 h-4 text-gray-500" />
      </div>
      <div className="flex-1">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value || '-'}</p>
      </div>
    </div>
  );

  const SectionCard = ({ 
    title, 
    icon: Icon, 
    iconBg, 
    iconColor, 
    children 
  }: { 
    title: string; 
    icon: any; 
    iconBg: string; 
    iconColor: string; 
    children: React.ReactNode 
  }) => (
    <Card className="border shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", iconBg)}>
            <Icon className={cn("w-5 h-5", iconColor)} />
          </div>
          <CardTitle className="text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
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
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-gray-900">{trf.trfNumber}</h1>
            <StatusBadge status={trf.status} />
          </div>
          <p className="text-gray-500 mt-1">
            Created on {formatDateTime(trf.createdAt)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && onEdit && (
            <Button variant="outline" onClick={onEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
          )}
          {canDelete && onDelete && (
            <Button variant="destructive" onClick={onDelete}>
              Delete
            </Button>
          )}
        </div>
      </div>

      {/* Status Timeline */}
      {(trf.submittedAt || trf.approvedAt) && (
        <Card className="border shadow-sm bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-600">
                  Created: {formatDateTime(trf.createdAt)}
                </span>
              </div>
              {trf.submittedAt && (
                <>
                  <div className="w-1 h-1 bg-gray-300 rounded-full" />
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-blue-500" />
                    <span className="text-sm text-gray-600">
                      Submitted: {formatDateTime(trf.submittedAt)}
                    </span>
                  </div>
                </>
              )}
              {trf.approvedAt && (
                <>
                  <div className="w-1 h-1 bg-gray-300 rounded-full" />
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-gray-600">
                      {trf.status === 'APPROVED' ? 'Approved' : 'Processed'}: {formatDateTime(trf.approvedAt)}
                    </span>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Employee Information */}
      <SectionCard
        title="Employee Information"
        icon={User}
        iconBg="bg-blue-50"
        iconColor="text-blue-600"
      >
        {trf.employee && (
          <div className="space-y-4">
            <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-2xl font-semibold text-blue-700">
                  {trf.employee.employeeName.charAt(0)}
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{trf.employee.employeeName}</h3>
                <p className="text-gray-500">{trf.employee.jobTitle}</p>
                <Badge variant="secondary" className="mt-1">
                  {trf.employee.employeeType}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoRow icon={Building} label="Department" value={trf.employee.department} />
              <InfoRow icon={Briefcase} label="Tenant" value={trf.employee.tenant} />
              <InfoRow icon={MapPin} label="Section" value={trf.employee.section} />
              <InfoRow icon={MapPin} label="Point of Hire" value={trf.employee.pointOfHire} />
              <InfoRow icon={Mail} label="Email" value={trf.employee.email} />
              <InfoRow icon={Phone} label="Phone" value={trf.employee.phone} />
              <InfoRow icon={Calendar} label="Date of Hire" value={formatDate(trf.employee.dateOfHire)} />
              <InfoRow icon={Shield} label="MCU Status" value={trf.employee.mcuStatus} />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Travel Purpose */}
      <SectionCard
        title="Travel Purpose"
        icon={Target}
        iconBg="bg-green-50"
        iconColor="text-green-600"
      >
        <div className="space-y-4">
          <div>
            <p className="text-xs text-gray-500">Purpose</p>
            <p className="text-lg font-medium text-gray-900">{trf.travelPurpose}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Start Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(trf.startDate)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">End Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(trf.endDate)}</p>
            </div>
          </div>

          {trf.purposeRemarks && (
            <div>
              <p className="text-xs text-gray-500">Remarks</p>
              <p className="text-sm text-gray-700 mt-1">{trf.purposeRemarks}</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* Accommodation */}
      {trf.accommodation && (
        <SectionCard
          title="Accommodation"
          icon={Hotel}
          iconBg="bg-indigo-50"
          iconColor="text-indigo-600"
        >
          <div className="space-y-4">
            <div>
              <p className="text-xs text-gray-500">Hotel</p>
              <p className="text-lg font-medium text-gray-900">{trf.accommodation.hotelName}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500">Check-in Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(trf.accommodation.checkInDate)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Check-out Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(trf.accommodation.checkOutDate)}
                </p>
              </div>
            </div>

            {trf.accommodation.remarks && (
              <div>
                <p className="text-xs text-gray-500">Remarks</p>
                <p className="text-sm text-gray-700 mt-1">{trf.accommodation.remarks}</p>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Travel Arrangements */}
      {trf.travelArrangements.length > 0 && (
        <SectionCard
          title="Travel Arrangements"
          icon={Plane}
          iconBg="bg-orange-50"
          iconColor="text-orange-600"
        >
          <div className="space-y-4">
            {trf.travelArrangements.map((arrangement, index) => (
              <div
                key={arrangement.id || index}
                className={cn(
                  'border rounded-lg p-4',
                  arrangement.travelType === 'TRAVEL_IN'
                    ? 'border-blue-200 bg-blue-50/30'
                    : 'border-green-200 bg-green-50/30'
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <Badge
                    variant="outline"
                    className={cn(
                      arrangement.travelType === 'TRAVEL_IN'
                        ? 'border-blue-300 text-blue-700'
                        : 'border-green-300 text-green-700'
                    )}
                  >
                    {arrangement.travelType === 'TRAVEL_IN' ? 'Travel In' : 'Travel Out'}
                  </Badge>
                  <span className="text-sm text-gray-500 capitalize">
                    {arrangement.arrangementType.replace('_', ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Transportation</p>
                    <p className="text-sm font-medium text-gray-900 capitalize">
                      {arrangement.transportation.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Travel Date</p>
                    <p className="text-sm font-medium text-gray-900">
                      {formatDate(arrangement.travelDate)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">From</p>
                    <p className="text-sm font-medium text-gray-900">{arrangement.fromLocation}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">To</p>
                    <p className="text-sm font-medium text-gray-900">{arrangement.toLocation}</p>
                  </div>
                </div>

                {arrangement.specialArrangement && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium">Special Arrangement</p>
                    <p className="text-sm text-amber-800 mt-1">{arrangement.justification}</p>
                  </div>
                )}

                {arrangement.remarks && (
                  <div className="mt-3">
                    <p className="text-xs text-gray-500">Remarks</p>
                    <p className="text-sm text-gray-700">{arrangement.remarks}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Approval Info */}
      {trf.approverName && (
        <Card className="border shadow-sm bg-gray-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {trf.status === 'APPROVED' ? 'Approved by' : 'Processed by'}: {trf.approverName}
                </p>
                <p className="text-xs text-gray-500">
                  {formatDateTime(trf.approvedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default TRFDetailView;
