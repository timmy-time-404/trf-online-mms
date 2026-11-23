# 0002. Monorepo pnpm

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

Dua developer mengerjakan frontend dan backend, dan keduanya perlu berbagi kosakata domain (peran, status).

## Keputusan

Satu repo dengan pnpm workspaces:

- `apps/web`: frontend React.
- `apps/api`: backend Hono.
- `packages/shared`: skema Zod dan tipe bersama.

`pnpm check` menjalankan lint, typecheck, test, dan build di semua paket. CI menjalankan perintah yang sama.

## Alternatif yang ditolak

- **Repo terpisah:** dua tempat issue/PR, dan tipe harus disinkronkan manual.
- **npm workspaces:** tidak tegas terhadap dependency yang tidak dideklarasikan, dan tidak ada daftar izin *install script*.

## Konsekuensi

Developer perlu memasang pnpm 10. Install script dependency hanya boleh berjalan kalau terdaftar di `pnpm-workspace.yaml`.
