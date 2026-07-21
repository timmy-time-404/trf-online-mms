// Kirim notifikasi WhatsApp lewat Fonnte, DIPROXY lewat Supabase Edge Function
// "send-whatsapp" supaya token Fonnte tidak pernah ter-expose ke browser.
//
// PENTING: jangan panggil api.fonnte.com langsung dari kode frontend/browser.
// Token akan terlihat oleh siapa pun yang membuka devtools kalau begitu.

import { supabase, isSupabaseEnabled } from './supabase';

/**
 * Normalisasi nomor HP Indonesia ke format yang diterima Fonnte (mis. 62812xxxxxxx).
 * Menerima input seperti: 0812xxxxxxx, +62812xxxxxxx, 62812xxxxxxx, 812xxxxxxx
 */
export const normalizeIndonesianPhone = (phone: string | null | undefined): string | null => {
  if (!phone) return null;

  let cleaned = phone.replace(/[\s\-()]/g, '');
  cleaned = cleaned.replace(/^\+/, '');

  if (cleaned.startsWith('0')) {
    cleaned = '62' + cleaned.slice(1);
  } else if (!cleaned.startsWith('62')) {
    cleaned = '62' + cleaned;
  }

  // Validasi kasar: hanya digit, panjang wajar untuk nomor Indonesia
  if (!/^62\d{8,13}$/.test(cleaned)) return null;

  return cleaned;
};

export interface SendWhatsAppOptions {
  /** URL publik file yang mau dikirim sebagai lampiran (dokumen/gambar). */
  fileUrl?: string;
  /** Nama file yang tampil di WA, mis. "Hotel Voucher.pdf". */
  fileName?: string;
}

export const sendWhatsAppMessage = async (
  phone: string | null | undefined,
  message: string,
  options: SendWhatsAppOptions = {},
): Promise<boolean> => {
  if (!isSupabaseEnabled()) return false;

  const target = normalizeIndonesianPhone(phone);
  if (!target) {
    console.warn('sendWhatsAppMessage: nomor HP tidak valid, dilewati:', phone);
    return false;
  }

  try {
    const { data, error } = await supabase.functions.invoke('send-whatsapp', {
      body: {
        target,
        message,
        url: options.fileUrl,
        filename: options.fileName,
      },
    });

    if (error) {
      console.error('Notifikasi WA gagal (edge function error):', error);
      return false;
    }

    // Log respons mentah dari Fonnte supaya gampang di-debug lewat console
    // kalau teks terkirim tapi lampiran filenya tidak (mis. URL tidak bisa
    // diakses Fonnte / bucket storage private).
    console.log('Fonnte response:', data);

    if (data?.status === false) {
      console.error('Notifikasi WA gagal (Fonnte error):', data?.reason);
      return false;
    }

    return true;
  } catch (err) {
    console.error('Notifikasi WA gagal:', err);
    return false;
  }
};

/** @deprecated pakai sendWhatsAppMessage - dipertahankan supaya kode lama tetap jalan */
export const sendWhatsAppNotification = async (
  phone: string | null | undefined,
  message: string,
): Promise<boolean> => sendWhatsAppMessage(phone, message);
