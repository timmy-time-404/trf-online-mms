// Helper terpusat: dipanggil setiap kali status TRF berubah (verifikasi,
// approve, reject, revise, edit&approve, process) untuk mengirim notifikasi
// WhatsApp ke employee pemilik TRF.
//
// Dipakai dari KEDUA implementasi addStatusHistory yang ada di codebase ini
// (src/store/index.ts dan src/store/supabaseStore.ts) supaya seluruh alur
// approval — termasuk tombol "Process" milik GA yang lewat jalur terpisah —
// tetap mengirim notifikasi WA.

import { supabase, isSupabaseEnabled } from './supabase';
import { sendWhatsAppNotification } from './whatsapp';
import { buildTrfStatusWaMessage } from './waMessageTemplates';
import type { TRFStatus } from '@/types';

export interface NotifyStatusChangeParams {
  trfId: string;
  newStatus: TRFStatus;
  actorName: string;
  remarks?: string;
  /** true = status TIDAK berubah, ini murni edit (belum approve/final) */
  editedOnly?: boolean;
}

/**
 * Fire-and-forget: dipanggil TANPA await oleh pemanggil supaya latensi
 * Fonnte/edge function tidak memperlambat alur approval utama.
 */
export const notifyEmployeeStatusChangeWA = async (
  params: NotifyStatusChangeParams,
): Promise<void> => {
  if (!isSupabaseEnabled()) return;

  try {
    const { data: trf, error: trfError } = await supabase
      .from('trfs')
      .select('trf_number, employee_id')
      .eq('id', params.trfId)
      .single();

    if (trfError || !trf) {
      console.error('notifyEmployeeStatusChangeWA: TRF tidak ditemukan', trfError);
      return;
    }

    const { data: employee, error: empError } = await supabase
      .from('employees')
      .select('employee_name, phone')
      .eq('id', trf.employee_id)
      .single();

    if (empError || !employee) {
      console.error('notifyEmployeeStatusChangeWA: employee tidak ditemukan', empError);
      return;
    }

    if (!employee.phone) {
      console.warn(
        `notifyEmployeeStatusChangeWA: employee TRF ${params.trfId} tidak punya nomor HP, notifikasi WA dilewati.`,
      );
      return;
    }

    const message = buildTrfStatusWaMessage({
      trfNumber: trf.trf_number,
      employeeName: employee.employee_name,
      newStatus: params.newStatus,
      actorName: params.actorName,
      remarks: params.remarks,
      editedOnly: params.editedOnly,
    });

    await sendWhatsAppNotification(employee.phone, message);
  } catch (err) {
    console.error('notifyEmployeeStatusChangeWA error:', err);
  }
};
