// Kirim file dokumen perjalanan (hotel voucher, tiket pesawat/kapal, dll)
// ke WA employee, terpisah dari notifikasi teks status approval.
//
// Dipanggil dari ProcessPage saat GA menyelesaikan (confirm) proses TRF,
// untuk setiap dokumen yang berhasil diupload di dialog Process.

import { sendWhatsAppMessage } from './whatsapp';
import { supabase } from './supabase';

const DOCUMENT_LABELS: Record<string, string> = {
  hotelVoucher: 'Hotel Voucher',
  flightTicket: 'Flight Ticket',
  shipTicket: 'Ship Ticket',
};

const SIGNED_URL_EXPIRY_SECONDS = 60 * 60 * 24 * 7; // 7 hari

export interface TravelDocumentToSend {
  /** key internal, mis. 'hotelVoucher' | 'flightTicket' | 'shipTicket' */
  type: string;
  /** nama file asli, mis. 'voucher-hotel.pdf' */
  name: string;
  /** URL publik file (fallback kalau path tidak tersedia / signing gagal) */
  url: string;
  /** path di Supabase Storage bucket 'trf-documents', mis. '{trfId}/hotelVoucher-xxx.pdf' */
  path?: string;
}

const resolveDeliverableUrl = async (doc: TravelDocumentToSend): Promise<string> => {
  if (!doc.path) return doc.url;

  try {
    const { data, error } = await supabase.storage
      .from('trf-documents')
      .createSignedUrl(doc.path, SIGNED_URL_EXPIRY_SECONDS);

    if (error || !data?.signedUrl) {
      console.warn(
        `resolveDeliverableUrl: gagal buat signed URL untuk ${doc.path}, fallback ke public URL.`,
        error,
      );
      return doc.url;
    }

    return data.signedUrl;
  } catch (err) {
    console.warn('resolveDeliverableUrl error, fallback ke public URL:', err);
    return doc.url;
  }
};

export interface NotifyTravelDocumentsParams {
  employeePhone: string | null | undefined;
  employeeName: string;
  trfNumber: string;
  documents: TravelDocumentToSend[];
}

/**
 * Mengirim setiap dokumen sebagai pesan WA terpisah (satu file per pesan,
 * sesuai cara kerja WhatsApp/Fonnte). Dipanggil TANPA await oleh caller
 * (fire-and-forget) supaya tidak menghambat alur "Process" GA.
 */
export const notifyEmployeeTravelDocumentsWA = async (
  params: NotifyTravelDocumentsParams,
): Promise<void> => {
  const { employeePhone, employeeName, trfNumber, documents } = params;

  if (!documents.length) return;

  if (!employeePhone) {
    console.warn(
      `notifyEmployeeTravelDocumentsWA: employee TRF ${trfNumber} tidak punya nomor HP, dokumen tidak dikirim.`,
    );
    return;
  }

  for (const doc of documents) {
    const label = DOCUMENT_LABELS[doc.type] || doc.type;
    const caption =
      `Halo ${employeeName},\n\n` +
      `Berikut *${label}* untuk TRF *${trfNumber}* kamu.\n\n` +
      `_Pesan otomatis dari TRF Online MMS._`;

    // eslint-disable-next-line no-await-in-loop
    const deliverableUrl = await resolveDeliverableUrl(doc);

    // Dikirim berurutan (bukan Promise.all) supaya tidak membanjiri
    // rate limit Fonnte kalau dokumennya banyak.
    // eslint-disable-next-line no-await-in-loop
    const success = await sendWhatsAppMessage(employeePhone, caption, {
      fileUrl: deliverableUrl,
      fileName: doc.name,
    });

    if (!success) {
      console.error(
        `notifyEmployeeTravelDocumentsWA: gagal kirim ${label} untuk TRF ${trfNumber}`,
      );
    }
  }
};
