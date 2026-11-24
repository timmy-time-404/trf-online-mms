# Panduan development

Panduan ini untuk siapa pun yang mengembangkan TRF Online: kamu, rekan tim, maupun AI agent. Ikuti urutannya dari atas.

## 1. Prinsip: tiga lingkungan, data tidak pernah dicampur

| Lingkungan | Dipakai untuk | Database | Data | Secret |
|---|---|---|---|---|
| **Local** (laptop masing-masing) | Menulis dan mencoba kode | PostgreSQL di Docker (`compose.dev.yaml`) | Dummy dari seed | `.dev/` + `apps/api/.env` (tidak di-commit) |
| **Staging** (menyusul) | Uji bersama sebelum rilis | DB terpisah di VPS | Dummy | Di server |
| **Production** (`meong-mms.org`) | Pengguna sungguhan | DB produksi di VPS | Data nyata | Di server dan GitHub Secrets |

Aturannya sama seperti di industri:

- **Kode sama, konfigurasi beda.** Nama variabel environment identik di semua lingkungan (`DB_HOST`, `APP_ORIGIN`, dan seterusnya), hanya nilainya yang berbeda.
- **Data produksi tidak pernah dibawa ke laptop.** Untuk mereproduksi bug, buat data dummy yang mirip.
- **Secret tidak pernah masuk Git atau chat.** Di lokal tersimpan di `.dev/`, di server di `deploy/secrets/`, dan untuk CI di GitHub Secrets.
- **Skema database hanya berubah lewat migrasi** (`db/migrations`). Migrasi yang sama berjalan berurutan di lokal, lalu CI, lalu produksi.

## 2. Setup laptop (sekali saja)

Prasyarat: Git, Node.js 24+, pnpm 10 (`npm install -g pnpm@10`), dan Docker Desktop.

```bash
git clone https://github.com/timmy-time-404/trf-online-mms.git
cd trf-online-mms
pnpm install
pnpm dev:setup      # buat .dev/ (secret lokal) dan apps/api/.env
pnpm dev:db         # jalankan PostgreSQL 17 lokal di Docker (port 5433)
pnpm db:init        # migrasi + akun API terbatas + data dummy
pnpm dev            # API http://localhost:3000 + web http://localhost:5173
```

Akun dummy lokal (username dan password acak) ada di `.dev/dummy-accounts.json`. File ini khusus untuk laptopmu dan berbeda dengan akun di server.

Perintah lain:

| Perintah | Fungsi |
|---|---|
| `pnpm db:reset` | Hapus database lokal dan buat ulang dari nol (migrasi + seed) |
| `pnpm dev:db:stop` | Matikan database lokal |
| `pnpm check` | Lint, typecheck, tes, dan build (sama dengan CI) |
| `pnpm --filter @trf/api test:workflow` | Tes integrasi terhadap PostgreSQL (database harus bernama `*_test`) |

Tanpa Docker? Pakai PostgreSQL lokal biasa lalu arahkan ke sana: `DEV_DB_PORT=5432 DEV_DB_USER=postgres DEV_DB_PASSWORD_FILE=/path/password pnpm db:init`.

## 3. Alur kerja harian (berdua)

```
main  ─────────────●─────────────●──────  produksi (deploy otomatis + approval)
                   ▲             ▲
dev   ──●──●──●────┴──●──●───────┴──────  integrasi
        ▲  ▲          ▲
feat/…  ┘  fix/…      feat/…               satu branch per pekerjaan
```

1. `git switch dev && git pull`
2. `git switch -c feat/nama-singkat` (atau `fix/…`, `refactor/…`, `docs/…`)
3. Kerjakan di lokal, commit kecil-kecil dengan format Conventional Commits (`feat: …`, `fix: …`).
4. `pnpm check` harus lolos sebelum push.
5. Push lalu buka PR ke `dev`. CI berjalan otomatis (Checks, Deployment foundation, PR title).
6. **Rekan me-review dan approve.** Jangan merge PR sendiri tanpa review.
7. Rilis: PM membuka PR `dev → main`, me-merge, lalu **menyetujui deploy** di tab Actions.

Detail aturan review ada di `CONTRIBUTING.md`, dan pola kode backend di `docs/backend-conventions.md`.

## 4. CI/CD

| Kejadian | Yang berjalan |
|---|---|
| PR ke `dev` atau `main` | `Checks` (lint, typecheck, tes, build), `Deployment foundation` (migrasi + seluruh tes integrasi di Docker), `PR title` |
| Push ke `main` | Workflow **Deploy**: `pnpm check`, lalu **menunggu approval** di environment `production`, lalu rilis ke VPS lewat `deploy/release.sh`, lalu health check publik |
| Manual (Actions → Deploy → Run workflow → isi `rollback_to`) | Rollback ke tag rilis sebelumnya |

Setiap rilis otomatis:

1. Membuat backup database (`/opt/trf-dev/backups`, 5 terakhir disimpan).
2. Mengganti source, build image, migrasi, dan restart.
3. **Kembali otomatis ke rilis sebelumnya** kalau health check gagal.

Migrasi hanya maju. Rollback aman hanya ke rilis yang cocok dengan skema saat ini.

## 5. Menambah fitur: checklist

- [ ] Branch dari `dev`
- [ ] Perubahan skema? Buat migrasi baru `db/migrations/00NN_*.sql` beserta grant-nya. Migrasi lama tidak diubah.
- [ ] Endpoint baru? Ikuti `docs/backend-conventions.md` (cek peran di server, Zod, transaksi, `If-Match`)
- [ ] Tes integrasi untuk jalur sukses dan ditolak
- [ ] Perubahan aturan bisnis? Harus ada keputusan pemilik di `docs/spec/decisions-*.md`
- [ ] Dicoba di lokal (`pnpm dev`) untuk setiap peran yang terdampak
- [ ] `pnpm check` lolos, PR, review, merge

## 6. Data

- **Lokal:** seed dummy (`pnpm db:init`). Boleh dihapus dan dibuat ulang kapan saja.
- **Produksi:** data nyata masuk lewat aplikasi (onboarding HR, User Management) atau impor terkontrol yang di-review. Seed dummy menolak berjalan di database yang tidak ditandai `development`.
- Jangan menjalankan SQL manual di produksi. Kalau terpaksa, tulis sebagai migrasi atau skrip yang di-review, dan ambil backup dulu.
