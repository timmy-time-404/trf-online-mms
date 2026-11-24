# 0007. Dokumen GA disimpan di disk VPS

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

GA mengunggah tiket dan voucher. Volumenya kecil, karena penggunanya sekitar 200 orang.

## Keputusan

- File disimpan di direktori data di VPS, misalnya `/var/lib/trf/uploads`.
- Metadata file disimpan di Postgres.
- File hanya bisa diunduh lewat API setelah izin dicek.
- Akses file dibungkus *interface* `FileStorage`, sehingga nanti bisa dipindah ke penyimpanan S3-compatible.

## Alternatif yang ditolak

- **MinIO:** menambah satu layanan lagi yang harus dirawat.
- **Object storage eksternal:** menambah biaya dan ketergantungan untuk volume sekecil ini.

## Konsekuensi

Folder upload **wajib** ikut backup terjadwal ke luar VPS, bersama database.
