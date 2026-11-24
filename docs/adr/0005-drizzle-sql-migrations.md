# 0005. Drizzle ORM dan migrasi SQL yang di-review

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

Schema lama dipertahankan. Query harus mudah di-review oleh orang yang bukan penulisnya.

## Keputusan

Pakai Drizzle ORM.

- Schema TypeScript awal dibuat dengan `drizzle-kit pull` dari database hasil migrasi.
- Migrasi pertama adalah schema Supabase yang sudah dibersihkan.
- Setiap perubahan berikutnya dibuat dengan `drizzle-kit generate`. Hasilnya berupa file `.sql` di `db/migrations/` yang di-commit dan di-review.
- `drizzle-kit push` tidak pernah dipakai ke database bersama.

## Alternatif yang ditolak

- **Prisma:** memakai bahasa schema sendiri, kontrol SQL lebih sedikit, dan lebih berat.
- **Kysely:** sangat baik dan paling transparan. Drizzle dipilih karena migrasi dan introspeksi sudah termasuk.

## Konsekuensi

Operasi workflow (ubah status + history + outbox) ditulis eksplisit dalam satu `db.transaction` dengan conditional update.
