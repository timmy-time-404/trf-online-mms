// Template pesan WhatsApp untuk setiap perubahan status TRF.
// Semua teks dalam Bahasa Indonesia, ringkas & jelas untuk dibaca di HP.

import type { TRFStatus } from '@/types';

export interface WaMessageParams {
  trfNumber: string;
  employeeName: string;
  newStatus: TRFStatus;
  actorName: string;
  remarks?: string;
  /** true = status TIDAK berubah, ini murni edit (belum approve/final) */
  editedOnly?: boolean;
}

const STATUS_TEXT: Partial<Record<TRFStatus, (p: WaMessageParams) => string>> = {
  PENDING_APPROVAL: (p) =>
    `TRF *${p.trfNumber}* kamu sudah diverifikasi oleh Admin Dept (${p.actorName}) dan menunggu approval HOD.`,
  HOD_APPROVED: (p) =>
    `TRF *${p.trfNumber}* kamu sudah *disetujui HOD* (${p.actorName}), menunggu approval HR.`,
  HR_APPROVED: (p) =>
    `TRF *${p.trfNumber}* kamu sudah *disetujui HR* (${p.actorName}), menunggu approval PM.`,
  PM_APPROVED: (p) =>
    `TRF *${p.trfNumber}* kamu sudah *disetujui PM* (${p.actorName}), menunggu diproses GA.`,
  GA_PROCESSED: (p) =>
    `TRF *${p.trfNumber}* kamu sudah *diproses GA* (${p.actorName}). Tiket/voucher perjalanan sudah siap, silakan cek di aplikasi.`,
  REJECTED: (p) =>
    `TRF *${p.trfNumber}* kamu *ditolak* oleh ${p.actorName}.${
      p.remarks ? `\nAlasan: ${p.remarks}` : ''
    }`,
  NEEDS_REVISION: (p) =>
    `TRF *${p.trfNumber}* kamu dikembalikan untuk *revisi* oleh ${p.actorName}.${
      p.remarks ? `\nCatatan: ${p.remarks}` : ''
    }\nSilakan cek & perbaiki di aplikasi.`,
};

export const buildTrfStatusWaMessage = (params: WaMessageParams): string => {
  const header = `Halo ${params.employeeName},`;

  if (params.editedOnly) {
    const body =
      `Detail TRF *${params.trfNumber}* kamu telah *diedit* oleh ${params.actorName}.\n` +
      `TRF ini *belum final disetujui* — masih menunggu proses dokumen (voucher/tiket) lebih lanjut.`;
    const notePart = params.remarks?.trim() ? `\n\nCatatan: ${params.remarks}` : '';
    return `${header}\n\n${body}${notePart}\n\n_Pesan otomatis dari TRF Online MMS._`;
  }

  const bodyBuilder = STATUS_TEXT[params.newStatus];
  const body = bodyBuilder
    ? bodyBuilder(params)
    : `Status TRF *${params.trfNumber}* kamu berubah menjadi *${params.newStatus}* oleh ${params.actorName}.`;

  // Catatan tambahan (mis. dari HR/GA saat mode "Edit & Approve") — hanya
  // ditambahkan jika belum tersirat di body (HOD_APPROVED, HR_APPROVED, dst
  // tidak menyertakan remarks di body, jadi tampilkan di sini bila ada).
  const includeSeparateRemarks =
    params.remarks &&
    params.newStatus !== 'REJECTED' &&
    params.newStatus !== 'NEEDS_REVISION';

  const notePart = includeSeparateRemarks ? `\n\nCatatan: ${params.remarks}` : '';

  return `${header}\n\n${body}${notePart}\n\n_Pesan otomatis dari TRF Online MMS._`;
};
