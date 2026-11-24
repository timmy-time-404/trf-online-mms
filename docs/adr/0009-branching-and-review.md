# 0009. Alur branch dev/main dan aturan review

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

Proyek dikerjakan dua developer dengan bantuan AI. @timmy-time-404 berperan sebagai Project Manager.

## Keputusan

- `main` untuk produksi, `dev` untuk integrasi/staging.
- Pekerjaan dilakukan di feature branch (`feat/…`, `fix/…`, dan seterusnya) yang dibuat dari `dev`.
- PR ke `dev` butuh CI hijau dan 1 approval dari rekan, jadi kedua developer saling me-review.
- PR rilis `dev → main` hanya boleh di-merge oleh PM, lewat ruleset *Restrict updates* dengan bypass admin.
- Merge memakai squash dengan judul Conventional Commits.
- Branch lama `dev2` dihapus karena isinya sudah ada di `main`.

## Konsekuensi

Tidak ada yang bisa merge kodenya sendiri tanpa dilihat orang lain. Langkah penerapannya di GitHub ada di `docs/github-setup.md`.
