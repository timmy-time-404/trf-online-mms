# TRF Online MMS

Sistem internal **Travel Request Form (TRF)** untuk PT Merdeka Mining Servis: pengajuan perjalanan dinas, approval berjenjang (Admin Dept → HOD → HR → PM), pemrosesan tiket/hotel oleh GA, Early Recall, serta roster & saldo OS.

> **Status:** pengembangan dengan data dummy di https://meong-mms.org. Backend sendiri (Node.js + Hono + PostgreSQL 17) sudah menggantikan Supabase; versi lama tersimpan di tag `legacy-v0`. Lihat [ADR](docs/adr/README.md).

## Struktur repo

```
apps/web/          Frontend React + Vite
apps/api/          Backend: Hono di Node.js (auth, TRF, workflow, master data, roster, early recall, dokumen, WhatsApp)
packages/shared/   Kosakata domain bersama (peran, status) dalam Zod
db/                Migrasi SQL PostgreSQL
deploy/            Docker Compose, Caddy, panduan rilis
docs/              Spesifikasi bisnis, ADR, panduan
```

## Mulai cepat

Prasyarat: Node.js 24+ (lihat `.nvmrc`) dan pnpm 10.

```bash
npm install -g pnpm@10
pnpm install
cp apps/web/.env.example apps/web/.env   # API di path /api
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
