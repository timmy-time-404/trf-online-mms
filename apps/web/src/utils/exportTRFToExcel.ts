import writeXlsxFile from 'write-excel-file/browser';
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

export const exportTRFToExcel = async (trf: TRF): Promise<void> => {
  // Pisahkan jadwal perjalanan keberangkatan (Out) dan kepulangan (In)
  // Pisahkan jadwal perjalanan sesuai TravelType yang aktif di aplikasi.
  const travelOut = trf.travelArrangements?.find(
    (arr) => arr.travelType === 'TRAVEL_OUT'
  );
  const travelIn = trf.travelArrangements?.find(
    (arr) => arr.travelType === 'TRAVEL_IN'
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
    trf.employee?.employeeCode ?? '-',
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

  // ── 3. SIMPAN FILE (header beku, lebar kolom seragam) ───────────────
  const fileName = `TRF_${trf.trfNumber}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  await writeXlsxFile([headers, row], {
    sheet: 'TRF Data', columns: headers.map(() => ({ width: 20 })), stickyRowsCount: 1,
  }).toFile(fileName);
};