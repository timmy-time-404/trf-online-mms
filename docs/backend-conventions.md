# Konvensi backend (`apps/api`)

Panduan singkat agar setiap fitur baru ditulis dengan pola yang sama. Contoh paling lengkap untuk ditiru: `apps/api/src/modules/trf/` (CRUD + workflow) dan `apps/api/src/modules/documents/` (upload + akses berizin).

## Struktur modul

```
apps/api/src/modules/<domain>/
  routes.ts       HTTP saja: parse input, panggil service, set header (ETag)
  service.ts      Aturan bisnis + transaksi; melempar HTTPException
  repository.ts   SQL saja (postgres.js tagged template), tanpa aturan bisnis
  policy.ts       Siapa boleh melihat/mengubah apa (opsional)
```

Daftarkan router di `apps/api/src/app.ts`. Router yang butuh login dibuat dengan `protectedRoutes(db, origin, roles?, maxBodyBytes?)` — sudah termasuk cek sesi, cek peran, cek header `Origin` untuk request yang mengubah data, batas ukuran body, dan penanganan error.

## Aturan wajib

1. **Otorisasi di server.** UI boleh menyembunyikan tombol, tetapi setiap endpoint tetap mengecek peran (`requireRole` / `protectedRoutes(..., roles)`) dan visibilitas data (`policy.ts`). Data yang tidak boleh dilihat dijawab **404**, bukan 403, supaya keberadaannya tidak bocor.
2. **Validasi input dengan Zod** (`parse`, `jsonBody`). Skema yang juga dipakai frontend diletakkan di `packages/shared`.
3. **Perubahan status = satu transaksi** (`db.begin`): update bersyarat (`WHERE id=… AND version=… AND status=…`), tulis `status_history`, dan masukkan `notification_outbox`. Jika update tidak mengubah baris → **409**.
4. **Concurrency TRF (D13):** setiap mutasi wajib header `If-Match: "<version>"` (428 bila tidak ada, 409 bila beda). Pembuatan TRF memakai `If-Match: "0"` — konvensi proyek ini; jangan diganti tanpa memperbarui client dan semua tes.
5. **Kode status HTTP:** 400 input/aturan bisnis, 401 belum login, 403 peran salah, 404 tidak ada/tidak terlihat, 409 konflik status/versi, 413 terlalu besar, 428 tanpa `If-Match`. Pesan error dalam bahasa Indonesia yang bisa ditindaklanjuti pengguna.
6. **Jangan pernah mengembalikan `password_hash`** atau secret. Pilih kolom secara eksplisit (lihat `users/repository.ts`).
7. **Notifikasi WhatsApp** hanya lewat `notification_outbox`; tidak ada panggilan HTTP ke pihak ketiga di dalam request.
8. **Tanggal bisnis** memakai `businessDate()` (TS) / `public.business_date()` (SQL) — zona Asia/Makassar (D7). **Department** dibandingkan dengan `normalizeDepartment()` / `public.normalize_department()` (D6).

## Database

- Perubahan skema = file baru `db/migrations/00NN_<nama>.sql` + entri di `meta/_journal.json`. Jangan mengubah migrasi yang sudah di-deploy.
- Role aplikasi `trf_auth_runtime` hanya diberi hak minimum; tambahkan `GRANT` yang dibutuhkan di migrasi yang sama.
- Ambil backup sebelum migrasi (lihat `docs/deployment.md`).

## Tes

- Unit test Vitest untuk logika murni (`*.test.ts`).
- **Tes integrasi wajib untuk setiap endpoint baru**, terhadap PostgreSQL sungguhan: `apps/api/src/*.integration.ts` (database harus bernama `*_test`). Uji jalur sukses **dan** penolakan (401/403/404/409).
- Setelah deploy, jalankan audit domain `deploy/smoke/domain-smoke.mjs` (cara pakai di kepala file).

## Checklist PR backend

- [ ] Peran & visibilitas dicek di server
- [ ] Input divalidasi Zod
- [ ] Mutasi dalam transaksi dengan update bersyarat
- [ ] Migrasi + grant (jika perlu), tanpa mengubah migrasi lama
- [ ] Tes integrasi sukses + ditolak
- [ ] `pnpm check` lulus
