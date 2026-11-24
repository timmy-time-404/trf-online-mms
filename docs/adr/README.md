# Architecture Decision Records

Setiap keputusan arsitektur penting dicatat sebagai satu file pendek: konteks, keputusan, dan konsekuensinya. ADR tidak diedit setelah diterima. Kalau keputusan berubah, buat ADR baru yang menggantikannya (*Digantikan oleh*).

| No. | Judul | Status |
|---|---|---|
| [0001](0001-legacy-as-living-spec.md) | Sistem lama menjadi spesifikasi hidup untuk rewrite | Diterima |
| [0002](0002-monorepo-pnpm.md) | Monorepo pnpm: apps/web, apps/api, packages/shared | Diterima |
| [0003](0003-postgresql.md) | PostgreSQL 17 dengan schema yang sama | Diterima |
| [0004](0004-typescript-hono-node.md) | Backend TypeScript: Node.js LTS + Hono | Diterima |
| [0005](0005-drizzle-sql-migrations.md) | Drizzle ORM dan migrasi SQL yang di-review | Diterima |
| [0006](0006-server-sessions.md) | Sesi di server dengan cookie HttpOnly, argon2id, dan link undangan | Diterima |
| [0007](0007-file-storage-disk.md) | Dokumen GA disimpan di disk VPS | Diterima |
| [0008](0008-outbox-notifications.md) | Notifikasi WhatsApp lewat outbox Postgres | Diterima |
| [0009](0009-branching-and-review.md) | Alur branch dev/main dan aturan review | Diterima |

Template untuk ADR baru: [template.md](template.md).
