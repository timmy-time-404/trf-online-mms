# Pengaturan repo GitHub

Langkah ini dilakukan sekali oleh pemilik repo (**@timmy-time-404**) di GitHub. Repo saat ini **publik** dan milik akun pribadi.

## 1. Tambahkan rekan sebagai collaborator

Settings → Collaborators → **Add people** → `rivall02`. Peran default di repo pribadi adalah *write*: bisa push branch dan membuka PR, tetapi bukan admin.

## 2. Ruleset untuk `main` (produksi)

Settings → Rules → Rulesets → **New branch ruleset**

| Isian | Nilai |
|---|---|
| Name | `main` |
| Enforcement status | Active |
| Target branches | Include by pattern: `main` |
| Bypass list | **Repository admin**, mode *For pull requests only* |
| Restrict deletions | ✅ |
| Block force pushes | ✅ |
| Require a pull request before merging | ✅ — Required approvals: **1**, Dismiss stale approvals ✅, Require review from Code Owners ✅, Require conversation resolution ✅ |
| Require status checks to pass | ✅ — tambahkan `lint, typecheck, test, build` dan `conventional-commit` (muncul setelah CI pernah berjalan sekali) |
| Restrict updates | ✅ — hanya bypass list (admin = PM) yang bisa memperbarui `main`, sehingga rilis hanya oleh PM |

> Karena hanya ada dua orang, PR rilis dari PM tetap butuh approval dari `rivall02`. Kalau rekan tidak tersedia, PM bisa memakai bypass. Bypass tercatat di log ruleset, jadi gunakan hanya untuk keadaan darurat.

## 3. Ruleset untuk `dev` (integrasi)

Sama seperti `main`, **tanpa** *Restrict updates* dan dengan bypass list kosong. Hasilnya: semua perubahan masuk lewat PR dengan 1 approval dan CI hijau.

## 4. Pengaturan umum

Settings → General:

- **Pull Requests:** aktifkan *Allow squash merging* saja. Default message: *Pull request title*. Ini membuat riwayat `dev`/`main` rapi dan setiap commit = satu PR Conventional Commit.
- Aktifkan *Automatically delete head branches*.

Settings → Code security:

- Aktifkan **Dependabot alerts** dan **Dependabot security updates**. Konfigurasi versi ada di `.github/dependabot.yml`.
- Aktifkan **Secret scanning** dan **Push protection**.

## 5. Verifikasi

1. Coba `git push origin main` langsung. Hasilnya harus ditolak.
2. Buka PR kecil ke `dev`. Pastikan CI berjalan dan tombol merge terkunci sampai ada approval.

## Catatan visibilitas repo

Repo ini publik, sedangkan kodenya milik sistem internal perusahaan. Catatan audit sengaja disimpan di luar repo (`docs/internal/`, di-ignore). Pertimbangkan menjadikan repo **private** (Settings → General → Danger Zone → Change visibility). Catatan: pada akun gratis, ruleset dan proteksi branch untuk repo private memerlukan GitHub Pro, atau repo dipindah ke organisasi dengan paket yang sesuai.
