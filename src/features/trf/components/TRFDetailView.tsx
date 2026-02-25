import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import StatusBadge from '@/components/common/StatusBadge';
import { useAuthStore } from '@/store';
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
  Shield,
  Ticket,
  Car,
  FileText,
  MessageSquare,
  Download
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
  const { currentUser } = useAuthStore();

  const canEdit = trf.status === 'DRAFT' || trf.status === 'NEEDS_REVISION';
  const canDelete = trf.status === 'DRAFT';
  const isEmployee = currentUser?.role === 'EMPLOYEE';
  const canSeeVoucher = trf.status === 'GA_PROCESSED' || (trf.gaProcess?.processed && isEmployee);

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

  // Render approval timeline
  const renderApprovalTimeline = () => {
    const steps = [
      { 
        label: 'Submitted', 
        date: trf.submittedAt,
        done: true,
        icon: Clock
      },
      { 
        label: 'Admin Dept Verified', 
        date: trf.adminDeptVerify?.verifiedAt,
        done: !!trf.adminDeptVerify?.verified,
        icon: CheckCircle,
        by: trf.adminDeptVerify?.verifierName,
        remarks: trf.adminDeptVerify?.remarks
      },
      { 
        label: 'HoD Approved', 
        date: trf.parallelApproval?.hod?.actionAt,
        done: trf.parallelApproval?.hod?.status === 'APPROVED',
        icon: Briefcase,
        by: trf.parallelApproval?.hod?.actionByName,
        remarks: trf.parallelApproval?.hod?.remarks
      },
      { 
        label: 'HR Approved', 
        date: trf.parallelApproval?.hr?.actionAt,
        done: trf.parallelApproval?.hr?.status === 'APPROVED',
        icon: User,
        by: trf.parallelApproval?.hr?.actionByName,
        remarks: trf.parallelApproval?.hr?.remarks
      },
      { 
        label: 'PM Approved', 
        date: trf.pmApproval?.approvedAt,
        done: trf.pmApproval?.approved,
        icon: Shield,
        by: trf.pmApproval?.approverName,
        remarks: trf.pmApproval?.remarks
      },
      { 
        label: 'GA Processed', 
        date: trf.gaProcess?.processedAt,
        done: trf.gaProcess?.processed,
        icon: Plane,
        by: trf.gaProcess?.processorName
      },
    ];

    return (
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Approval Timeline</h3>
        <div className="relative">
          {steps.map((step, index) => (
            <div key={index} className="flex gap-4 pb-4 last:pb-0">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center",
                  step.done ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-400"
                )}>
                  <step.icon className="w-4 h-4" />
                </div>
                {index < steps.length - 1 && (
                  <div className={cn(
                    "w-0.5 flex-1 my-1",
                    step.done ? "bg-green-300" : "bg-gray-200"
                  )} />
                )}
              </div>
              <div className="flex-1 pb-4">
                <p className={cn(
                  "font-medium",
                  step.done ? "text-gray-900" : "text-gray-500"
                )}>
                  {step.label}
                </p>
                {step.done && step.date && (
                  <p className="text-sm text-gray-500">{formatDateTime(step.date)}</p>
                )}
                {step.by && (
                  <p className="text-sm text-gray-600">by {step.by}</p>
                )}
                {step.remarks && (
                  <p className="text-sm text-gray-500 mt-1 italic">"{step.remarks}"</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

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

      {/* Approval Timeline */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          {renderApprovalTimeline()}
        </CardContent>
      </Card>

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

      {/* VOUCHER SECTION - Only visible when GA_PROCESSED */}
      {canSeeVoucher && trf.gaProcess && (
        <SectionCard
          title="Travel Voucher & Tickets"
          icon={Ticket}
          iconBg="bg-green-50"
          iconColor="text-green-600"
        >
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="font-semibold text-green-900">Processed by GA</span>
              </div>
              <p className="text-sm text-green-700">
                {formatDateTime(trf.gaProcess.processedAt)} by {trf.gaProcess.processorName}
              </p>
            </div>

            {trf.gaProcess.voucherDetails?.hotelVoucher && (
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Hotel className="w-5 h-5 text-blue-600" />
                  <span className="font-medium text-blue-900">Hotel Voucher</span>
                </div>
                <p className="text-sm text-blue-800">{trf.gaProcess.voucherDetails.hotelVoucher}</p>
              </div>
            )}

            {trf.gaProcess.voucherDetails?.flightTicket && (
              <div className="p-4 bg-indigo-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Plane className="w-5 h-5 text-indigo-600" />
                  <span className="font-medium text-indigo-900">Flight Ticket</span>
                </div>
                <p className="text-sm text-indigo-800">{trf.gaProcess.voucherDetails.flightTicket}</p>
              </div>
            )}

            {trf.gaProcess.voucherDetails?.transportation && (
              <div className="p-4 bg-orange-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Car className="w-5 h-5 text-orange-600" />
                  <span className="font-medium text-orange-900">Ground Transportation</span>
                </div>
                <p className="text-sm text-orange-800">{trf.gaProcess.voucherDetails.transportation}</p>
              </div>
            )}

            {trf.gaProcess.voucherDetails?.other && (
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <FileText className="w-5 h-5 text-gray-600" />
                  <span className="font-medium text-gray-900">Other Details</span>
                </div>
                <p className="text-sm text-gray-700">{trf.gaProcess.voucherDetails.other}</p>
              </div>
            )}

            {/* Files */}
            {trf.gaProcess.files && trf.gaProcess.files.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-gray-700 flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Attachments
                </p>
                <div className="flex flex-wrap gap-2">
                  {trf.gaProcess.files.map((file, idx) => (
                    <Button key={idx} variant="outline" size="sm" className="text-xs">
                      <FileText className="w-3 h-3 mr-1" />
                      {file}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Message from GA */}
            {trf.gaProcess.remarksToEmployee && (
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-5 h-5 text-amber-600" />
                  <span className="font-medium text-amber-900">Message from GA</span>
                </div>
                <p className="text-sm text-amber-800 italic">"{trf.gaProcess.remarksToEmployee}"</p>
              </div>
            )}
          </div>
        </SectionCard>
      )}

      {/* Legacy Approval Info (for backward compatibility) */}
      {trf.approverName && !trf.pmApproval && (
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