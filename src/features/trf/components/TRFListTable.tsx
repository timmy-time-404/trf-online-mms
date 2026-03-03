import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import StatusBadge from '@/components/common/StatusBadge';
import type { TRF } from '@/types';
import { Eye, Edit, Trash2, FileText, Calendar, Download } from 'lucide-react'; 

interface TRFListTableProps {
  trfs: TRF[];
  onDelete?: (id: string) => void;
  showActions?: boolean;
}

const TRFListTable: React.FC<TRFListTableProps> = ({
  trfs,
  onDelete,
  showActions = true
}) => {
  const navigate = useNavigate();

  const canEdit = (trf: TRF) => {
    return trf.status === 'DRAFT' || trf.status === 'REVISED';
  };

  const canDelete = (trf: TRF) => {
    return trf.status === 'DRAFT';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getDateRange = (trf: TRF) => {
    return `${formatDate(trf.startDate)} - ${formatDate(trf.endDate)}`;
  };

  if (trfs.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-xl">
        <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No TRF found</h3>
        <p className="text-gray-500 mt-1">Create a new travel request to get started</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <Table>
        <TableHeader>
          <TableRow className="bg-gray-50 hover:bg-gray-50">
            <TableHead className="w-32">TRF Number</TableHead>
            <TableHead>Employee</TableHead>
            <TableHead>Purpose</TableHead>
            <TableHead>Date Range</TableHead>
            <TableHead className="w-24">Status</TableHead>
            <TableHead className="w-32">Submitted</TableHead>
            {showActions && <TableHead className="text-right">Actions</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {trfs.map((trf) => {
            // ✅ REVISI: Mengubah Object JSON menjadi Array dengan aman
            const gaDocsObject = (trf as any).gaDocuments;
            const gaDocs = gaDocsObject ? Object.values(gaDocsObject) : [];

            return (
              <TableRow
                key={trf.id}
                className="cursor-pointer hover:bg-gray-50"
                onClick={() => navigate(`/trf/${trf.id}`)}
              >
                <TableCell>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <span className="font-medium text-gray-900">{trf.trfNumber}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                      <span className="text-xs font-medium text-gray-600">
                        {trf.employee?.employeeName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{trf.employee?.employeeName}</p>
                      <p className="text-xs text-gray-500">{trf.employee?.department}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <p className="text-sm text-gray-900">{trf.travelPurpose}</p>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{getDateRange(trf)}</span>
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={trf.status} size="sm" />
                </TableCell>
                <TableCell>
                  <span className="text-sm text-gray-600">
                    {trf.submittedAt ? formatDate(trf.submittedAt) : '-'}
                  </span>
                </TableCell>
                
                {showActions && (
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      
                      {/* ✅ REVISI: DAFTAR DOKUMEN DOWNLOAD YANG SUDAH DISEDERHANAKAN */}
                      {gaDocs.length > 0 && (
                        <div className="flex items-center gap-1.5">
                          {gaDocs.map((file: any, index: number) => {
                            if (!file || typeof file !== 'object' || !file.url) return null;

                            return (
                              <a
                                key={index}
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[13px] font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2.5 h-8 rounded-md transition-colors whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <Download className="w-3 h-3" />
                                <span>{file.name || 'Download'}</span>
                              </a>
                            );
                          })}
                        </div>
                      )}

                      {/* Garis pemisah (divider) agar UI lebih rapi */}
                      {gaDocs.length > 0 && (
                        <div className="w-px h-4 bg-gray-200 mx-1"></div>
                      )}

                      {/* Tombol View, Edit, Delete */}
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-gray-500 hover:text-gray-900 hover:bg-gray-100"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/trf/${trf.id}`);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>

                        {canEdit(trf) && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/trf/${trf.id}/edit`);
                            }}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        )}

                        {canDelete(trf) && onDelete && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete(trf.id);
                            }}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>

                    </div>
                  </TableCell>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default TRFListTable;