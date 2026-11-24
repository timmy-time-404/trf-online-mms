# 0003. PostgreSQL 17 dengan schema yang sama

- Status: Diterima (dikonfirmasi ulang setelah schema Supabase dianalisis)
- Tanggal: 2026-11-23

## Konteks

Sistem melayani sekitar 200 pengguna di satu VPS. Datanya relasional (TRF, karyawan, history, roster, ledger OS), workflow approval butuh transaksi, dan ada kolom JSON. Schema saat ini adalah PostgreSQL (Supabase).

## Keputusan

Pakai PostgreSQL 17 di VPS. Tabel, kolom, constraint, dan fungsi bisnis dipindah apa adanya. Bagian khusus Supabase dibuang:

- schema `auth` dan `storage`,
- peran `anon` dan `authenticated`,
- kebijakan RLS untuk peran-peran tersebut.

Otorisasi pindah ke API.

## Alternatif yang ditolak

- **SQLite:** cukup untuk skala ini, tetapi schema harus diterjemahkan dan sulit menambah server kedua.
- **MySQL/MariaDB:** tidak ada keunggulan teknis untuk kasus ini, dan schema harus diterjemahkan.

## Konsekuensi

Butuh sekitar 100–200 MB RAM dan backup terjadwal (`pg_dump`). Detail backup dibahas di sesi deployment.
