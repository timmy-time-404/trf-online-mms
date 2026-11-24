# Spesifikasi bisnis (diekstrak dari sistem lama)

Dokumen ini menjelaskan **perilaku sistem lama apa adanya** (tag `legacy-v0`; path `supabase/functions` dan `apps/web/src/store/supabaseStore.ts` yang disebut di bawah hanya ada di tag itu), bukan perilaku yang ideal. Dokumen ini menjadi acuan untuk rewrite backend: kalau backend baru berperilaku berbeda, perbedaan itu harus disengaja dan tercatat sebagai keputusan.

Setiap aturan diberi label sumber:

- **[kode]**: terbukti dari kode di repo (`apps/web`, `supabase/functions`), dengan lokasi file.
- **[DB?]**: dijalankan di database atau di Edge Function yang **tidak ada di repo**, jadi perlu dikonfirmasi dari schema Supabase.
- **[dok]**: berasal dari dokumen bisnis (presentasi/flowchart), belum ada di kode.

| Dokumen | Isi |
|---|---|
| [roles.md](roles.md) | Tujuh peran dan apa yang boleh dilihat/dilakukan masing-masing |
| [trf-workflow.md](trf-workflow.md) | State machine TRF, verifikasi, approval, revisi, proses GA |
| [trf-data.md](trf-data.md) | Isi form TRF, aturan validasi, tujuan perjalanan, lumpsum |
| [early-recall.md](early-recall.md) | State machine Early Recall |
| [roster-os.md](roster-os.md) | Roster site/cuti dan saldo OS |
| [notifications.md](notifications.md) | Notifikasi WhatsApp dan in-app |
| [decisions-2026-11-24.md](decisions-2026-11-24.md) | **Keputusan pemilik yang mengubah perilaku lama** (berlaku di atas dokumen lain) |

Tes yang mengunci perilaku ini ada di `apps/web/src/**/*.characterization.test.ts`.
