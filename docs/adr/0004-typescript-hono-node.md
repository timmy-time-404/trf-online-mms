# 0004. Backend TypeScript: Node.js LTS + Hono

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

Kedua developer menulis TypeScript dengan bantuan AI. Go sempat dipilih, lalu dibatalkan karena tim belum menguasainya sehingga review kode backend akan lemah. Targetnya: ringan, bukan serverless, dan mudah dibaca.

## Keputusan

Pakai Node.js LTS + Hono (`@hono/node-server`).

- Validasi request dan dokumentasi OpenAPI dibuat dari skema Zod (`@hono/zod-openapi`).
- Skema dipakai bersama frontend lewat `packages/shared`.
- Struktur kode per domain: `apps/api/src/modules/<domain>/`.

## Alternatif yang ditolak

- **Go:** operasional paling sederhana, tetapi tim belum bisa me-review kodenya.
- **Fastify:** sama baiknya. Hono dipilih karena integrasi Zod/OpenAPI dan client bertipe sudah bawaan.
- **Express 5:** tidak punya struktur dan validasi bawaan.
- **NestJS:** berat dan banyak "magic".
- **Bun:** keunggulannya tidak terasa di skala ini, dan Node lebih matang untuk operasional.

## Konsekuensi

Jumlah dependency npm dijaga ketat. Setiap dependency baru harus disebut alasannya di PR, dan Dependabot aktif.
