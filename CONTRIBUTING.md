# Panduan kontribusi

Repo ini dikelola dua developer: **@timmy-time-404** (Project Manager, pemegang rilis) dan **@rivall02**.

## Alur branch

```
feat/… fix/… refactor/… docs/… chore/…
        │  PR + 1 approval + CI hijau
        ▼
       dev   ← integrasi / staging
        │  PR rilis, di-merge hanya oleh PM
        ▼
       main  ← produksi
```

1. Ambil branch baru dari `dev` yang terbaru: `git switch dev && git pull && git switch -c feat/nama-singkat`.
2. Commit kecil dan sering. Satu PR = satu tujuan.
3. Buka PR ke `dev`. Isi template, termasuk cara menguji.
4. Minta review dari rekan. **Jangan merge PR sendiri tanpa approval.**
5. Rilis: PM membuka PR `dev → main` dan me-merge-nya.

Hotfix produksi: branch `fix/…` dari `main`, PR ke `main`, lalu merge balik `main → dev`.

## Pesan commit dan judul PR

Pakai [Conventional Commits](https://www.conventionalcommits.org/) dalam bahasa Inggris:

```
feat: add HR lumpsum dropdown
fix: keep TRF in place when delete fails
refactor(web): split TRF store by domain
docs: describe early recall states
```

Tipe yang dipakai: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Judul PR dicek otomatis.

## Standar kode

- TypeScript `strict`. Hindari `any`; kalau terpaksa, jelaskan alasannya di komentar.
- Nama di kode dan komentar dalam **bahasa Inggris**; komentar menjelaskan *kenapa*, bukan *apa*. Dokumen di `docs/` dalam **bahasa Indonesia**. Teks UI mengikuti yang sudah ada.
- Aturan bisnis (approval, H-14, lumpsum, roster/OS) **tidak diubah** tanpa issue yang disetujui pemilik proses. Rujukannya [docs/spec](docs/spec/README.md).
- Setiap perubahan perilaku disertai tes. Bug fix diawali tes yang gagal.
- Dependency baru harus disebut di deskripsi PR beserta alasannya.

## Sebelum membuka PR

```bash
pnpm check
```

Perintah ini sama dengan yang dijalankan CI.

## Review

Reviewer memeriksa:

1. Apakah perilaku sesuai spesifikasi dan ada tesnya?
2. Untuk perubahan login, sesi, peran, approval, atau data karyawan: apakah otorisasinya dicek di server, bukan hanya disembunyikan di UI?
3. Apakah ada secret, token, atau data pribadi di diff?
4. Apakah kodenya bisa dipahami tanpa penjelasan lisan?

Tinggalkan komentar yang spesifik. Bedakan yang **wajib** diubah dan yang sekadar **saran** (awali dengan `nit:`).

## Secret

Jangan pernah commit `.env`. Gunakan `.env.example` sebagai contoh. Kalau secret sempat ter-commit, anggap bocor: segera rotasi, baru hapus dari riwayat.
