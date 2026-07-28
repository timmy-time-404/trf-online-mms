import React from 'react';
import { Clock, FileText } from 'lucide-react';

import StatusBadge from '@/components/common/StatusBadge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { format } from '@/lib/utils';
import { useTRFStore } from '@/store';
import type { TRF, User } from '@/types';

interface RecentActivityTableProps {
  user: User;
}

const RecentActivityTable: React.FC<
  RecentActivityTableProps
> = ({ user }) => {
  const trfs = useTRFStore((state) => state.trfs);
  const employees = useTRFStore(
    (state) => state.employees,
  );
  const getVisibleTRFs = useTRFStore(
    (state) => state.getVisibleTRFs,
  );

  /*
   * Recent Activity must use the same role-based visibility
   * as the Travel Request list.
   */
  const recentTRFs = React.useMemo(() => {
    return [...getVisibleTRFs(user)]
      .sort(
        (first, second) =>
          new Date(second.updatedAt).getTime() -
          new Date(first.updatedAt).getTime(),
      )
      .slice(0, 5);
  }, [
    employees,
    getVisibleTRFs,
    trfs,
    user,
  ]);

  const getActivityDescription = (trf: TRF) => {
    const employeeName =
      trf.employee?.employeeName ?? 'Karyawan';

    const approverName =
      trf.pmApproval?.approverName ?? 'Approver';

    switch (trf.status) {
      case 'DRAFT':
        return `Dibuat oleh ${employeeName}`;

      case 'SUBMITTED':
        return `Diajukan oleh ${employeeName}`;

      case 'ADMIN_DEPT_VERIFIED':
        return 'Telah diverifikasi oleh Admin Department';

      case 'PENDING_APPROVAL':
        return 'Menunggu persetujuan Head of Department';

      case 'HOD_APPROVED':
        return 'Telah disetujui oleh Head of Department';

      case 'HR_APPROVED':
        return 'Telah disetujui oleh HR';

      case 'PM_APPROVED':
        return `Telah disetujui oleh ${approverName}`;

      case 'GA_PROCESSED':
        return 'Dokumen perjalanan telah diproses oleh GA';

      case 'REJECTED':
        return `Ditolak oleh ${approverName}`;

      case 'REVISED':
      case 'NEEDS_REVISION':
        return `Dikembalikan untuk revisi oleh ${approverName}`;

      default:
        return 'TRF diperbarui';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();

    const diffInHours =
      (now.getTime() - date.getTime()) /
      (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Baru saja';
    }

    if (diffInHours < 24) {
      return `${Math.floor(diffInHours)} jam lalu`;
    }

    return format(date, 'MMM dd, yyyy HH:mm');
  };

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50">
            <Clock className="h-5 w-5 text-orange-600" />
          </div>

          <div>
            <CardTitle className="text-lg">
              Recent Activity
            </CardTitle>

            <p className="text-sm text-gray-500">
              Aktivitas TRF terbaru sesuai akses Anda
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-32">
                  TRF Number
                </TableHead>

                <TableHead>Activity</TableHead>

                <TableHead>Employee</TableHead>

                <TableHead className="w-28">
                  Status
                </TableHead>

                <TableHead className="w-32 text-right">
                  Time
                </TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {recentTRFs.map((trf) => {
                const employeeName =
                  trf.employee?.employeeName ??
                  'Unknown Employee';

                return (
                  <TableRow
                    key={trf.id}
                    className="hover:bg-gray-50"
                  >
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-gray-400" />

                        <span className="whitespace-nowrap font-medium text-gray-900">
                          {trf.trfNumber}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <p className="min-w-52 text-sm text-gray-600">
                        {getActivityDescription(trf)}
                      </p>
                    </TableCell>

                    <TableCell>
                      <div className="flex min-w-44 items-center gap-2">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-200">
                          <span className="text-xs font-medium text-gray-600">
                            {employeeName
                              .charAt(0)
                              .toUpperCase()}
                          </span>
                        </div>

                        <span className="text-sm text-gray-700">
                          {employeeName}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <StatusBadge
                        status={trf.status}
                        size="sm"
                      />
                    </TableCell>

                    <TableCell className="text-right">
                      <span className="whitespace-nowrap text-sm text-gray-500">
                        {formatDate(trf.updatedAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {recentTRFs.length === 0 && (
          <div className="py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
              <FileText className="h-8 w-8 text-gray-400" />
            </div>

            <p className="text-gray-500">
              Tidak ada aktivitas terbaru
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityTable;