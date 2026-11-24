# Keputusan pemilik proyek — 24 November 2026

Keputusan ini **mengubah** perilaku sistem lama yang dijelaskan di dokumen spesifikasi lain. Kalau ada pertentangan, dokumen ini yang berlaku. Tes karakterisasi untuk perilaku yang diubah harus diperbarui bersama implementasinya.

| No. | Topik | Keputusan |
|---|---|---|
| D1 | Code owner | `@tmthyjw23` (Project Manager) dan `@rivall02` |
| D2 | Approver tidak tersedia | **Tahan** TRF di tahap tersebut sampai ada approver aktif. Tidak ada lagi skip otomatis, dan status `APPROVED` tidak pernah ditulis. HOD harus dari department yang sama dengan TRF. Admin dapat melihat TRF yang tertahan |
| D3 | SUPER_ADMIN | Tidak dapat approve atas nama orang lain. Tombol approve/verify/process disembunyikan untuk SUPER_ADMIN. Hak reject/revise tetap seperti lama |
| D4 | Proses GA | Minimal **1 dokumen** (tiket/voucher) wajib diunggah sebelum TRF bisa menjadi `GA_PROCESSED` |
| D5 | Ketersediaan kamar | Grafik okupansi dihapus. Hotel cukup CRUD (nama, jumlah kamar). Perhitungan okupansi masuk daftar fitur baru |
| D6 | Pencocokan department | Semua pencocokan department (daftar, antrean, dashboard) tidak peka huruf besar/kecil dan spasi di tepi |
| D7 | Zona waktu | Tanggal bisnis (nomor TRF, "hari ini" di statistik, minggu berjalan) memakai **Asia/Makassar (WITA)**. Nomor TRF yang sudah ada tidak diubah |
| D8 | H-14 | Pengajuan kurang dari 14 hari sebelum tanggal berangkat (tanggal mulai tujuan pertama, WITA) **tetap boleh**, tetapi wajib mengisi alasan keterlambatan dan diberi tanda "Urgent (< H-14)" yang terlihat oleh semua approver |
| D9 | Draft dan pembatalan | Tambah "Simpan draft" (status `DRAFT`, bisa diedit/dihapus pemilik, dikirim menjadi `SUBMITTED`) dan "Batalkan TRF" oleh pemilik selama belum `GA_PROCESSED`/`REJECTED`, dengan alasan, tercatat di riwayat (status baru `CANCELLED`) |
| D10 | Reject | Wajib alasan dan dialog konfirmasi. Alasan dikirim ke karyawan lewat notifikasi |
| D11 | Lumpsum | Tetap dipilih manual oleh HR dari 17 nominal resmi. Belum ada tabel acuan |
| D12 | Akses data karyawan | EMPLOYEE hanya datanya sendiri; ADMIN_DEPT dan HOD hanya department-nya; HR, GA, PM, SUPER_ADMIN semua |
| D13 | Edit bersamaan | *Optimistic concurrency*: setiap TRF punya `version`; respons memuat `ETag`; setiap perubahan wajib `If-Match`; versi berbeda → 409 dan UI meminta muat ulang |
