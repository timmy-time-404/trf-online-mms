/**
 * ExportTRFButton.tsx
 *
 * Dua tombol export bersebelahan: Export Excel + Export PDF.
 * Hanya tampil untuk role: HOD, HR, PM, GA, SUPER_ADMIN.
 *
 * Cara pakai:
 *   import ExportTRFButton from '@/features/trf/components/ExportTRFButton';
 *   <ExportTRFButton trf={trf} />
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store';
import { exportTRFToExcel } from '@/utils/exportTRFToExcel';
import { exportTRFToPDF } from '@/utils/exportTRFToPDF';
import type { TRF, UserRole } from '@/types';

// Role yang diizinkan export
const ALLOWED_ROLES: UserRole[] = ['HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'];

interface ExportTRFButtonProps {
  trf: TRF;
}

const ExportTRFButton: React.FC<ExportTRFButtonProps> = ({ trf }) => {
  const { currentUser } = useAuthStore();
  const [isExportingExcel, setIsExportingExcel] = useState(false);
  const [isExportingPDF, setIsExportingPDF] = useState(false);

  // Sembunyikan untuk role yang tidak diizinkan
  if (!currentUser || !ALLOWED_ROLES.includes(currentUser.role)) {
    return null;
  }

  const handleExcelExport = async () => {
    setIsExportingExcel(true);
    try {
      await new Promise((r) => setTimeout(r, 200));
      exportTRFToExcel(trf);
    } catch (err) {
      console.error('Excel export failed:', err);
    } finally {
      setIsExportingExcel(false);
    }
  };

  const handlePDFExport = async () => {
    setIsExportingPDF(true);
    try {
      await exportTRFToPDF(trf);
    } catch (err) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPDF(false);
    }
  };

  const isAnyExporting = isExportingExcel || isExportingPDF;

  return (
    <div className="flex items-center gap-2">
      {/* ── EXCEL BUTTON ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExcelExport}
        disabled={isAnyExporting}
        className="gap-2 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800 hover:border-green-400 transition-colors"
      >
        {isExportingExcel ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileSpreadsheet className="w-4 h-4" />
        )}
        {isExportingExcel ? 'Exporting...' : 'Export Excel'}
      </Button>

      {/* ── PDF BUTTON ── */}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePDFExport}
        disabled={isAnyExporting}
        className="gap-2 text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 hover:border-red-400 transition-colors"
      >
        {isExportingPDF ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <FileText className="w-4 h-4" />
        )}
        {isExportingPDF ? 'Generating PDF...' : 'Export PDF'}
      </Button>
    </div>
  );
};

export default ExportTRFButton;