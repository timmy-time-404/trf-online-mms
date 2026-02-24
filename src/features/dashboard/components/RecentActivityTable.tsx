import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import StatusBadge from '@/components/common/StatusBadge';
import { useTRFStore } from '@/store';
import { Clock, FileText } from 'lucide-react';
import { format } from '@/lib/utils';

const RecentActivityTable: React.FC = () => {
  const { trfs } = useTRFStore();

  // Get recent TRFs sorted by updatedAt
  const recentTRFs = [...trfs]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  const getActivityDescription = (trf: typeof recentTRFs[0]) => {
    switch (trf.status) {
      case 'DRAFT':
        return `Created by ${trf.employee?.employeeName}`;
      case 'SUBMITTED':
        return `Submitted by ${trf.employee?.employeeName}`;
      case 'APPROVED':
        return `Approved by ${trf.approverName}`;
      case 'REJECTED':
        return `Rejected by ${trf.approverName}`;
      case 'REVISED':
        return `Returned for revision by ${trf.approverName}`;
      default:
        return 'Updated';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} hours ago`;
    } else {
      return format(date, 'MMM dd, yyyy HH:mm');
    }
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-orange-50 rounded-lg flex items-center justify-center">
            <Clock className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <CardTitle className="text-lg">Recent Activity</CardTitle>
            <p className="text-sm text-gray-500">Latest TRF updates</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-32">TRF Number</TableHead>
                <TableHead>Activity</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead className="w-28">Status</TableHead>
                <TableHead className="w-32 text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentTRFs.map((trf) => (
                <TableRow key={trf.id} className="cursor-pointer hover:bg-gray-50">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <span className="font-medium text-gray-900">{trf.trfNumber}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <p className="text-sm text-gray-600">{getActivityDescription(trf)}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center">
                        <span className="text-xs font-medium text-gray-600">
                          {trf.employee?.employeeName.charAt(0)}
                        </span>
                      </div>
                      <span className="text-sm text-gray-700">{trf.employee?.employeeName}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={trf.status} size="sm" />
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="text-sm text-gray-500">
                      {formatDate(trf.updatedAt)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {recentTRFs.length === 0 && (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-gray-400" />
            </div>
            <p className="text-gray-500">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityTable;
