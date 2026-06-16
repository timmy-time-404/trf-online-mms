import * as XLSX from 'xlsx';
import type { TRF, TravelArrangement, UserRole } from '@/types';

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────

function formatDate(dateStr?: string): string {
  if (!dateStr) return '-';
  try {
    return new Date(dateStr).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

function val(v: unknown): string {
  if (v === null || v === undefined || v === '') return '-';
  return String(v);
}

// ─────────────────────────────────────────────────────────────
// HEADERS — sama persis dengan exportTRF.ts (single)
// ─────────────────────────────────────────────────────────────
const HEADERS = [
  'Employee ID',
  'Employee Name',
  'Job Title',
  'Department',
  'Section',
  'Point of Hire',
  'Email',
  'Phone',
  'TRF Number',
  'Travel Purpose',
  'Purpose Remarks',
  'Start Date',
  'End Date',
  'Accommodation',
  'Check-In Date',
  'Check-Out Date',
  'Accommodation Remarks',
  'Travel Type',
  'Arrangement By',
  // Travel OUT columns (paling atas / paling awal)
  'Travel Out Date',
  'Transportation (Out)',
  'From (Out)',
  'To (Out)',
  // Travel IN columns (paling bawah / paling akhir)
  'Travel In Date',
  'Transportation (In)',
  'From (In)',
  'To (In)',
  'Special Arrangement',
  'Justification',
  'Arrangement Remarks',
  'Lumpsum Amount',
  'Lumpsum Currency',
  'Lumpsum Note',
  'Status',
  'Submitted At',
];

// ─────────────────────────────────────────────────────────────
// BUILD ROWS untuk satu TRF
// Satu arrangement = satu baris
// TRAVEL_OUT rows dulu, TRAVEL_IN rows belakangan
// ─────────────────────────────────────────────────────────────
function buildRowsForTRF(trf: TRF): (string | number)[][] {
  // Sort: TRAVEL_OUT first, TRAVEL_IN last
  const sorted = [...trf.travelArrangements].sort((a, b) => {
    if (a.travelType === 'TRAVEL_OUT' && b.travelType === 'TRAVEL_IN') return -1;
    if (a.travelType === 'TRAVEL_IN' && b.travelType === 'TRAVEL_OUT') return 1;
    return 0;
  });

  // Kalau tidak ada arrangement, tetap buat 1 baris dengan data TRF saja
  const rowSources: (TravelArrangement | null)[] =
    sorted.length > 0 ? sorted : [null];

  return rowSources.map((arr) => {
    const isIn  = arr?.travelType === 'TRAVEL_IN';
    const isOut = arr?.travelType === 'TRAVEL_OUT';

    return [
      // Employee info
      val(trf.employee?.id ?? trf.employeeId),
      val(trf.employee?.employeeName),
      val(trf.employee?.jobTitle),
      val(trf.employee?.department ?? trf.department),
      val(trf.employee?.section),
      val(trf.employee?.pointOfHire),
      val(trf.employee?.email),
      val(trf.employee?.phone),
      // TRF info
      val(trf.trfNumber),
      val(trf.travelPurpose),
      val(trf.purposeRemarks),
      formatDate(trf.startDate),
      formatDate(trf.endDate),
      // Accommodation
      val(trf.accommodation?.hotelName),
      formatDate(trf.accommodation?.checkInDate),
      formatDate(trf.accommodation?.checkOutDate),
      val(trf.accommodation?.remarks),
      // Arrangement type info
      arr ? val(arr.travelType) : '-',
      arr ? val(arr.arrangementType) : '-',
      // Travel OUT columns — hanya terisi jika TRAVEL_OUT
      isOut ? formatDate(arr?.travelDate)  : '-',
      isOut ? val(arr?.transportation)     : '-',
      isOut ? val(arr?.fromLocation)       : '-',
      isOut ? val(arr?.toLocation)         : '-',
      // Travel IN columns — hanya terisi jika TRAVEL_IN
      isIn  ? formatDate(arr?.travelDate)  : '-',
      isIn  ? val(arr?.transportation)     : '-',
      isIn  ? val(arr?.fromLocation)       : '-',
      isIn  ? val(arr?.toLocation)         : '-',
      // Detail tambahan
      arr ? (arr.specialArrangement ? 'Yes' : 'No') : '-',
      arr ? val(arr.justification) : '-',
      arr ? val(arr.remarks)       : '-',
      // Lumpsum
      trf.lumpsumAmount != null ? trf.lumpsumAmount : '-',
      val(trf.lumpsumCurrency),
      val(trf.lumpsumNote),
      // Status & timestamp
      val(trf.status),
      formatDate(trf.submittedAt),
    ];
  });
}

// ─────────────────────────────────────────────────────────────
// MAIN EXPORT FUNCTION — bulk / all TRFs
// ─────────────────────────────────────────────────────────────
export function exportAllTRFsToExcel(
  trfs: TRF[],
  role?: UserRole | string,
): void {
  if (trfs.length === 0) return;

  // Kumpulkan semua baris dari semua TRF
  const allRows: (string | number)[][] = [];

  trfs.forEach((trf) => {
    const rows = buildRowsForTRF(trf);
    allRows.push(...rows);
  });

  // Build sheet
  const wsData: (string | number)[][] = [HEADERS, ...allRows];
  const ws = XLSX.utils.aoa_to_sheet(wsData);

  // Auto column width
  ws['!cols'] = HEADERS.map((header, colIdx) => {
    const maxContent = Math.max(
      header.length,
      ...allRows.map((row) => String(row[colIdx] ?? '').length)
    );
    return { wch: Math.min(maxContent + 2, 45) };
  });

  // Freeze header row
  ws['!freeze'] = { xSplit: 0, ySplit: 1 };

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'TRF Report');

  // Nama file dengan tanggal export dan role
  const today     = new Date().toISOString().split('T')[0];
  const roleLabel = role ? `_${String(role).toUpperCase()}` : '';
  const fileName  = `TRF_Export${roleLabel}_${today}.xlsx`;

  XLSX.writeFile(wb, fileName);
}
