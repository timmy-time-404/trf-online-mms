# Notifikasi

## WhatsApp (Fonnte)

Dikirim melalui Edge Function `send-whatsapp` yang **tidak ada di repo**. [DB?] Nomor HP dinormalisasi ke format Indonesia. Nomor yang tidak valid dilewati. `apps/web/src/lib/whatsapp.ts`

| Pemicu | Penerima | Isi | Sumber |
|---|---|---|---|
| Setiap baris `status_history` dengan status lama (bukan pembuatan TRF) | Karyawan pemilik TRF | Template per status baru: `PENDING_APPROVAL`, `HOD_APPROVED`, `HR_APPROVED`, `PM_APPROVED`, `GA_PROCESSED`, `REJECTED`, `NEEDS_REVISION` | `store/index.ts` `addStatusHistory`, `lib/notifyStatusChangeWA.ts`, `lib/waMessageTemplates.ts` |
| GA mengedit TRF (status tetap) | Karyawan | Pesan "diedit", bukan "disetujui" | `editAndApproveTRF` |
| GA selesai memproses | Karyawan | Dokumen tiket/voucher terlampir | `lib/notifyTravelDocumentsWA.ts` |
| Early Recall | Karyawan | Template di `earlyRecallWaMessageTemplates.ts` | Helper `notifyEmployeeEarlyRecallWA` **tidak dipanggil** dari frontend, kemungkinan dari server [DB?] |

Semua pengiriman **dipicu dari browser** tanpa `await` (fire-and-forget). Kalau tab ditutup atau request gagal, notifikasi hilang tanpa jejak.

Tidak ada notifikasi ke **approver berikutnya**. Approver mengetahui ada pekerjaan dari badge di menu.

## In-app

Tabel `notifications` (penerima `user_id`, judul, pesan, status dibaca). `apps/web/src/store/notificationStore.ts`, `components/common/NotificationBell.tsx`. Klik notifikasi membuka detail TRF.

Sistem lama hanya membuat notifikasi in-app untuk HR Edit & Approve dan GA Edit. Sejak #14, notifikasi ditulis di transaksi yang sama dengan perubahan status (`apps/api/src/modules/trf/workflowRepository.ts`):

| Pemicu | Penerima | Judul |
|---|---|---|
| TRF menjadi `SUBMITTED` (kirim baru, kirim draft, kirim ulang revisi) | ADMIN_DEPT aktif, department sama | `TRF … menunggu verifikasi Anda` |
| `PENDING_APPROVAL` | HOD aktif, department sama | `TRF … menunggu approval Anda` |
| `HOD_APPROVED` / `HR_APPROVED` | HR / PM aktif | `TRF … menunggu approval Anda` |
| `PM_APPROVED` | GA aktif | `TRF … menunggu proses tiket/voucher` |
| `NEEDS_REVISION` | Pemilik TRF | `TRF … perlu direvisi` (pesan = alasan revisi) |
| `GA_PROCESSED` | Pemilik TRF | `Tiket/voucher TRF … sudah siap` (pesan = pesan GA) |
| Reject, pembatalan, HR Edit & Approve, GA Edit | Pemilik TRF | seperti sebelumnya |

Pelaku perubahan tidak menerima notifikasinya sendiri. Draft tidak memberi notifikasi. Notifikasi WhatsApp lewat `notification_outbox` tidak berubah.

## Badge menu

Dihitung di browser dari data TRF yang sudah dimuat: jumlah TRF menunggu verifikasi, approval, atau proses sesuai peran, ditambah Early Recall yang perlu tindakan dan antrean roster. `apps/web/src/layout/MainLayout.tsx`
