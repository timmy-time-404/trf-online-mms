# 0006. Sesi di server dengan cookie HttpOnly, argon2id, dan link undangan

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

Sistem lama menyimpan token sesi di `localStorage` dan membuat password awal akun baru di sisi browser.

## Keputusan

- Sesi disimpan di tabel `sessions` di Postgres. Tokennya acak 256-bit, dan yang disimpan di database hanya hash SHA-256-nya.
- Token dikirim lewat cookie `HttpOnly; Secure; SameSite=Lax`, dengan masa berlaku yang bergeser dan batas absolut.
- Password di-hash dengan argon2id (`@node-rs/argon2`).
- Akun baru dan reset password memakai link sekali pakai yang kedaluwarsa, bukan password awal yang dibuat admin.
- Logout dan menonaktifkan user langsung mencabut sesi.
- Implementasinya modul kecil buatan sendiri yang mengikuti panduan Lucia, bukan library auth.

## Alternatif yang ditolak

- **JWT:** sesi sulit dicabut, dan tidak dibutuhkan karena hanya ada satu backend.
- **Better Auth:** membawa tabel dan konvensinya sendiri yang bertabrakan dengan tabel `users` lama.

## Konsekuensi

Endpoint yang mengubah data butuh perlindungan CSRF. Kombinasi cookie SameSite dan pemeriksaan header `Origin` dianggap cukup untuk aplikasi satu domain.
