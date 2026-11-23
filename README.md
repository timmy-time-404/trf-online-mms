# TRF Online MMS

Sistem internal **Travel Request Form (TRF)** untuk PT Merdeka Mining Servis: pengajuan perjalanan dinas, approval berjenjang (Admin Dept → HOD → HR → PM), pemrosesan tiket/hotel oleh GA, Early Recall, serta roster & saldo OS.

> **Status:** pengembangan. Belum dipakai pengguna nyata dan belum di-deploy. Backend lama (Supabase) sedang diganti dengan API Node.js + PostgreSQL. Lihat [ADR](docs/adr/README.md).

## Struktur repo

```
apps/web/          Frontend React + Vite (versi lama, masih memanggil Supabase)
apps/api/          Backend baru: Hono di Node.js (kerangka, baru /health)
packages/shared/   Kosakata domain bersama (peran, status) dalam Zod
supabase/          Edge Functions lama — referensi sampai diganti apps/api
docs/              Spesifikasi bisnis, ADR, panduan
```

## Mulai cepat

Prasyarat: Node.js 24+ (lihat `.nvmrc`) dan pnpm 10.

```bash
npm install -g pnpm@10
pnpm install
cp apps/web/.env.example apps/web/.env   # isi dengan project Supabase dev
pnpm dev:web                              # http://localhost:5173
pnpm dev:api                              # http://localhost:3000/health
```

Sebelum membuka PR, jalankan pemeriksaan yang sama dengan CI:

```bash
pnpm check   # lint + typecheck + test + build untuk semua paket
```

## Dokumen penting

| Dokumen | Isi |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | Alur branch, commit, PR, dan review |
| [docs/spec/](docs/spec/README.md) | Spesifikasi bisnis yang diekstrak dari sistem lama |
| [docs/adr/](docs/adr/README.md) | Keputusan arsitektur dan alasannya |
| [docs/github-setup.md](docs/github-setup.md) | Proteksi branch dan pengaturan repo |
| [docs/deployment.md](docs/deployment.md) | Fondasi deployment privat dan batas kesiapan migrasi |
