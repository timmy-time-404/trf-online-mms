# 0001. Sistem lama menjadi spesifikasi hidup untuk rewrite

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

Sistem belum dipakai pengguna dan belum punya data. Database, backend, lalu frontend akan diganti. Aturan bisnis tersebar di frontend, Edge Functions, dan fungsi SQL Supabase, sebagian berada di luar repo.

## Keputusan

Kode lama tidak di-refactor besar-besaran. Nilainya diambil dalam bentuk spesifikasi tertulis (`docs/spec`), tes karakterisasi, dan schema database. Kode lama hanya diperbaiki seperlunya agar bisa dipahami dan dijalankan. Versi lama ditandai tag `legacy-v0`.

## Alternatif yang ditolak

- **Refactor penuh kode lama:** sebagian besar hasilnya akan dibuang.
- **Langsung rewrite tanpa spesifikasi:** aturan seperti skip approver, lumpsum, dan roster/OS berisiko hilang.

## Konsekuensi

Aturan bisnis tidak diubah dalam fase ini. Perubahan kebijakan dicatat sebagai issue dan diputuskan terpisah oleh pemilik proses.
