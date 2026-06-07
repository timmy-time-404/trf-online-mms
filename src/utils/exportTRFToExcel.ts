import * as XLSX from 'xlsx';
import type { TRF } from '@/types';

// Helper untuk format tanggal
const fmtDate = (d?: string): string => {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const exportTRFToExcel = (trf: TRF): void => {
  // Pisahkan jadwal perjalanan keberangkatan (Out) dan kepulangan (In)
  // Asumsi tipe perjalanan menggunakan standar kata 'DEPARTURE' dan 'RETURN'
  const travelOut = trf.travelArrangements?.find(
    (arr) => arr.travelType === 'DEPARTURE' || arr.travelType === 'OUTBOUND'
  );
  const travelIn = trf.travelArrangements?.find(
    (arr) => arr.travelType === 'RETURN' || arr.travelType === 'INBOUND'
  );

  // Ambil tipe arrangement umum (jika ada)
  const arrangementType =
    travelOut?.arrangementType || travelIn?.arrangementType || '-';

  // ── 1. DEFINISIKAN HEADER SESUAI GAMBAR ────────────────────────────────
  const headers = [
    'Company',
    'Employee ID',
    'Employee Name',
    'Department',
    'Section',
    'Position',
    'Point of Hire',
    'Email',
    'Phone',
    'Date of Hire',
    'Travel Purpose',
    'Start Date',
    'End Date',
    'Accommodation',
    'Check-In Date',
    'Check-Out Date',
    'Travel Arrangement Type',
    'Travel in Date',
    'Transportation Travel In',
    'From (In)',
    'To (In)',
    'Travel Out Date',
    'Transportation Travel Out',
    'From (Out)',
    'To (Out)',
    'Lumpsum',
    'Status',
  ];

  // ── 2. PETAKAN DATA TRF KE DALAM BARIS (ROW) ───────────────────────────
  const row = [
    trf.employee?.tenant ?? '-',
    (trf.employee as any)?.employeeId ?? '-', // Sesuaikan dengan properti ID di backend Anda
    trf.employee?.employeeName ?? '-',
    trf.employee?.department ?? '-',
    trf.employee?.section ?? '-',
    trf.employee?.jobTitle ?? '-',
    trf.employee?.pointOfHire ?? '-',
    trf.employee?.email ?? '-',
    trf.employee?.phone ?? '-',
    fmtDate(trf.employee?.dateOfHire),
    
    trf.travelPurpose ?? '-',
    fmtDate(trf.startDate),
    fmtDate(trf.endDate),
    
    trf.accommodation?.hotelName ?? 'Site Arrange',
    fmtDate(trf.accommodation?.checkInDate),
    fmtDate(trf.accommodation?.checkOutDate),
    
    arrangementType !== '-' ? arrangementType.replace(/_/g, ' ') : '-',
    
    // Data Travel In (Kepulangan)
    fmtDate(travelIn?.travelDate),
    travelIn?.transportation?.replace(/_/g, ' ') ?? '-',
    travelIn?.fromLocation ?? '-',
    travelIn?.toLocation ?? '-',

    // Data Travel Out (Keberangkatan)
    fmtDate(travelOut?.travelDate),
    travelOut?.transportation?.replace(/_/g, ' ') ?? '-',
    travelOut?.fromLocation ?? '-',
    travelOut?.toLocation ?? '-',

    // Lain-lain
    trf.lumpsumAmount ? trf.lumpsumAmount : '-',
    trf.status?.replace(/_/g, ' ') ?? '-',
  ];

  // ── 3. BANGUN WORKBOOK DAN WORKSHEET ───────────────────────────────────
  const wb = XLSX.utils.book_new();
  
  // Gabungkan Header dan Data
  const wsData = [headers, row];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Tambahkan AutoFilter di baris pertama (A1 sampai AA1) seperti di gambar
  ws['!autofilter'] = { ref: `A1:AA1` };

  // Atur lebar kolom agar lebih mudah dibaca saat diekspor
  ws['!cols'] = headers.map(() => ({ wch: 20 }));

  XLSX.utils.book_append_sheet(wb, ws, 'TRF Data');

  // ── 4. SIMPAN FILE ─────────────────────────────────────────────────────
  const fileName = `TRF_${trf.trfNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
};