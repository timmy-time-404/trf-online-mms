import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store';
import { exportTRFToExcel } from '@/utils/exportTRFToExcel';
import type { TRF, UserRole } from '@/types';

// Role yang diizinkan export
const ALLOWED_ROLES: UserRole[] = ['HOD', 'HR', 'PM', 'GA', 'SUPER_ADMIN'];

interface ExportTRFButtonProps {
  trf: TRF;
  variant?: 'default' | 'outline' | 'secondary';
  size?: 'default' | 'sm' | 'lg';
}

const ExportTRFButton: React.FC<ExportTRFButtonProps> = ({
  trf,
  variant = 'outline',
  size = 'sm',
}) => {
  const { currentUser } = useAuthStore();
  const [isExporting, setIsExporting] = useState(false);

  // Jangan render apapun kalau role tidak diizinkan
  if (!currentUser || !ALLOWED_ROLES.includes(currentUser.role)) {
    return null;
  }

  const handleExport = async () => {
    setIsExporting(true);
    try {
      // Beri sedikit delay agar spinner terlihat (UX)
      await new Promise((resolve) => setTimeout(resolve, 300));
      exportTRFToExcel(trf);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleExport}
      disabled={isExporting}
      className="gap-2 text-green-700 border-green-300 hover:bg-green-50 hover:text-green-800"
    >
      {isExporting ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="w-4 h-4" />
      )}
      {isExporting ? 'Exporting...' : 'Export Excel'}
    </Button>
  );
};

export default ExportTRFButton;