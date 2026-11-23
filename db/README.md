# Database mandiri

Baseline `migrations/0000_legacy_baseline.sql` mempertahankan skema/fungsi domain
lama tanpa data, tabel backup/staging, hosted Auth/Storage atau public grants.
FK approval hierarchy menunjuk `public.users`. Baseline berasal dari draft yang
dipulihkan dan diperiksa pada PostgreSQL 17. Drizzle menjalankan transaksi dan
mencatat migrasi pada schema `drizzle`. CLI memakai satu koneksi dan advisory lock.

Jangan mengedit migrasi yang sudah diterapkan. Tambahkan migrasi baru setelah SQL
ditinjau. Introspeksi TypeScript/snapshot masih perlu disiapkan sebelum memakai
`drizzle-kit generate`; jangan gunakan `push` pada database bersama.

Fungsi legacy SECURITY DEFINER menerima actor ID. API wajib memakai ID dari sesi
server. Jangan memberi browser akses SQL atau grant execute seluruh fungsi pada
role runtime. Role runtime dan grant spesifik disiapkan bersama endpoint; API saat
ini belum terhubung database.

Seed menyediakan satu akun tiap role, tujuh karyawan HRMD, referensi departemen,
pola roster 8:2, dan satu TRF DRAFT. Belum ada penugasan roster atau fixture alur
approval lengkap. Email memakai domain `.invalid`, telepon kosong. Seed tidak
mengirim pesan.

Seed hanya menerima dataset kosong dan aktivasi eksplisit. Password acak berbeda,
hash Argon2id, tanpa kewajiban ganti password untuk akun dummy selama pengujian.
File credential dibuat eksklusif, mode 0600.
Login dan ganti password belum tersedia pada backend baru. Jika transaksi atau
koneksi gagal, periksa DB dan file credential sebelum mencoba lagi; jangan hapus
file secara otomatis ketika status commit belum jelas. Seed ulang harus gagal
tanpa mereset data atau password yang sudah dibuat.

`tests/seed-contract.sql` memeriksa fixture dan sebagian akses Early Recall dengan
rollback. Jalankan pada database uji terpisah karena sequence dapat tetap bertambah
setelah rollback. Ini belum menggantikan pemeriksaan semua role dan alur.
