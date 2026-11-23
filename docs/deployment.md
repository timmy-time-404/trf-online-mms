# Deployment lingkungan pengembangan

## Status dan batas penggunaan

Konfigurasi `deploy/compose.yaml` menyiapkan PostgreSQL 17, API Hono, dan gateway
Caddy. API menyediakan `/health` dan autentikasi cookie; frontend dan alur bisnis masih bergantung
pada Supabase. Gateway menampilkan status pengembangan (HTTP 503) sampai migrasi
fitur selesai. Login API tersedia; integrasi UI dan migrasi modul bisnis belum selesai.
Supabase lama tetap tersedia dan tidak diubah oleh konfigurasi ini.

Target saat ini adalah lingkungan uji bersama pada satu VPS. Backup terjadwal
ditunda atas keputusan pemilik; volume persisten bukan backup. Gunakan data dummy.

## Persiapan host

- Docker Engine dan Compose yang mendukung `up --wait`.
- OpenSSL untuk menghasilkan secret lokal.
- Akses SSH dengan key. Untuk operasi rutin gunakan akun operator khusus;
  akses grup Docker setara hak root, jadi batasi siapa yang mendapatkannya.
- Simpan checkout rilis yang sudah ditinjau, misalnya `/opt/trf-dev/releases/<id>`.
  Jangan salin `.env` frontend, secret Supabase, atau `docs/internal` ke image.
- Periksa RAM dan disk sebelum deployment. Batas kontainer saat ini cocok untuk
  fondasi kecil, lalu sesuaikan berdasarkan pengukuran saat fitur ditambahkan.

## Menjalankan fondasi privat

Jalankan dari root checkout pada Linux:

```sh
cp deploy/.env.example deploy/.env
sh deploy/init-secrets.sh
# Edit RELEASE_TAG di deploy/.env menjadi identitas rilis yang sudah ditinjau.
docker compose --env-file deploy/.env -f deploy/compose.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml build api
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --wait --wait-timeout 120
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
curl --fail http://127.0.0.1:8080/api/health
```

Script secret tidak mengganti password yang sudah ada. PostgreSQL membaca
password awal dari file Compose secret; perubahan file tersebut setelah database
dibuat **tidak** merotasi password database. Jangan menaruh isi secret di log.
User `trf_owner` adalah administrator bootstrap; jangan gunakan untuk request API.
API belum diberi akses database. Role runtime dengan grant minimum perlu dibuat
bersama migrasi skema dan otorisasi API, sebelum menghubungkan fitur.

Database tidak memublikasikan port dan memakai jaringan internal tersendiri.
Gateway hanya terikat ke `127.0.0.1:8080`. Untuk mengakses dari komputer penguji:

```sh
ssh -N -L 8080:127.0.0.1:8080 <operator>@177.202.249.54
```

Buka `http://127.0.0.1:8080` melalui tunnel. Endpoint API adalah
`http://127.0.0.1:8080/api/health`. Respons ini adalah liveness proses API,
bukan pemeriksaan koneksi database maupun kesiapan fitur.

## Persistensi dan rilis

Migrasi dan seed dijalankan eksplisit dari root checkout setelah build API:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm db-tools
# Jalankan hanya pada database pengembangan baru yang kosong:
SEED_CONFIRM=trf-development-dummy-only docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm db-tools node dist/db/seed.js
```

File penyerahan password berada pada `deploy/secrets/dummy-accounts.json` di host,
mode 0600. Jangan masukkan ke Git atau log, dan jangan kirim isinya ke chat.
Seed membuat tujuh akun dummy tanpa kewajiban ganti password, tujuh karyawan HRMD, referensi
departemen, pola roster 8:2, dan satu TRF DRAFT. Menjalankan ulang seed akan gagal
tanpa mereset akun/data. Jika koneksi terputus saat seed, periksa DB dan file
credential sebelum mengulang. Akun dummy tidak diwajibkan mengganti password.

Untuk mengaktifkan autentikasi runtime setelah migrasi dan seed:

```sh
sh deploy/init-secrets.sh
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm db-tools node dist/db/provision-runtime.js
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.auth.yaml -f deploy/compose.domain.yaml up -d --wait
docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm -e AUTH_TEST_URL=http://api:3000/auth db-tools node dist/auth-smoke.js
```

Gunakan tiga file Compose tersebut untuk operasi rilis berikutnya. Role `trf_api`
hanya diberi akses tabel autentikasi, tanpa superuser, update user, SELECT TRF atau
execute fungsi domain. `provision-runtime` menyelaraskan password login DB dengan
file private `deploy/secrets/runtime_password`; jangan jalankan saat ada rotasi
password tanpa merencanakan restart API. File mount runtime dapat dibaca proses
non-root, sementara direktori host tetap mode 0700. File credential akun dummy
tetap mode 0600. Jangan memakai credential pemilik database pada API.

Endpoint `/api/auth/login`, `/me`, dan `/logout` memakai cookie Secure/HttpOnly,
Origin yang tepat untuk mutasi, expiry bergeser 30 menit dengan batas 12 jam,
dan pembatasan percobaan login per identifier. Belum ada perubahan password atau
undangan. `VITE_API_BASE_URL=/api` mengaktifkan adapter cookie frontend untuk uji
integrasi; modul bisnis yang belum dimigrasi mengembalikan error eksplisit.
Jangan merilis frontend mode ini sebelum akses data dan workflow dipindahkan.

Untuk uji migrasi, buat database kosong terpisah dan atur `DB_NAME` pada task;
ubah `SEED_CREDENTIALS_FILE` ke path berbeda di `/run/seed` untuk credential uji.
Periksa `deploy/verify-schema.sql` sebelum seed, lalu `db/tests/seed-contract.sql`
setelah seed menggunakan `psql -X -v ON_ERROR_STOP=1` pada database uji tersebut.
Lihat [db/README.md](../db/README.md) untuk batas pengujian dan aturan migrasi.

- Volume `trf-dev_database` berisi database, `trf-dev_documents` disiapkan untuk
  dokumen pada `/data/documents`. Endpoint dokumen belum diimplementasikan;
  direktori ini tidak diekspos sebagai file publik.
- Pertahankan nama project Compose `trf-dev` antar-rilis agar volume tetap sama.
- Jalankan `pnpm check` dan workflow `Deployment foundation` sebelum memakai rilis.
  Workflow membangun image, memeriksa HTTP, query database, dan shutdown API.
- Build image API dengan tag rilis baru; jangan menimpa tag rilis lama. Simpan
  image sebelumnya untuk rollback. Image Node, PostgreSQL, dan Caddy dikunci ke
  digest. Perbarui digest secara terencana dan jalankan ulang pemeriksaan container.
- Jalankan migrasi database sebagai langkah eksplisit setelah SQL ditinjau.
  Baseline berada di `db/migrations`; file audit/draft internal bukan input deployment.
- Untuk database validasi yang sudah dipulihkan dari draft tersebut, jalankan
  `psql -X -v ON_ERROR_STOP=1 -d <database-validasi> -f deploy/verify-schema.sql`.
  Skrip memeriksa jumlah objek, FK hierarki, akses default dan contoh aturan
  remarks; probe role/fungsi dibatalkan dengan rollback. Jalankan sebagai pemilik
  skema dengan hak membuat role. Ini bukan pengujian kesetaraan seluruh workflow.
- Rollback aplikasi: arahkan `RELEASE_TAG` ke image rilis sebelumnya yang masih
  tersedia pada host, lalu `up -d --no-build --wait`. Ini tidak membatalkan skema.
  Untuk perubahan skema, gunakan migrasi kompatibel dan langkah pemulihan tersendiri.
- `docker compose ... down` mempertahankan volume. **Jangan gunakan `down -v` pada
  lingkungan bersama**; opsi itu hanya dipakai CI untuk data sekali pakai.
- Log memakai rotasi 10 MB, maksimal 3 file per layanan. Periksa kesehatan dan
  kapasitas disk secara berkala; belum ada pemantauan eksternal atau job terjadwal.

## Syarat sebelum domain dibuka

Migrasikan autentikasi, otorisasi per role, TRF, approval, GA, early recall,
roster/OS, dokumen, serta notifikasi dan verifikasi terhadap spesifikasi lama.
Siapkan satu akun per role, termasuk `superadmin` dan `adm_hrmd_01`, dengan password
sementara berbeda; kewajiban ganti password akun dummy ditunda selama pengujian.
Siapkan fixture yang saling terhubung.
Pengiriman WhatsApp uji wajib dibatasi di backend ke dua nomor yang disetujui
pemilik; layanan pengiriman belum dikonfigurasi pada fondasi ini.

Domain terbaru yang dikonfirmasi pemilik adalah `meong-mms.org`.
Gateway TLS dapat disiapkan untuk status pengembangan menggunakan overlay berikut:

```sh
# Set APP_DOMAIN=meong-mms.org di deploy/.env, pastikan A/AAAA benar dan port 80/443 tersedia.
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.domain.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.domain.yaml up -d --wait
curl -I http://meong-mms.org/
curl -i https://meong-mms.org/
curl --fail https://meong-mms.org/api/health
```

Caddy menyimpan sertifikat di volume persisten. Jangan hapus volume TLS saat rilis.
Pastikan record AAAA tidak menunjuk ke hosting lain. Untuk VPS yang baru memakai
IPv4 ini, hapus AAAA lama pada domain utama sampai IPv6 VPS dikonfigurasi dan diuji.
Health check kontainer TLS hanya liveness, bukan validitas sertifikat. Respons root
tetap 503 selama fitur belum tersedia; health API 200 tidak membuktikan paritas bisnis.
Overlay ini belum menambahkan pembatasan akses penguji ketika fitur diaktifkan.

Sebelum fitur diaktifkan untuk penguji: siapkan pembatasan akses penguji,
pembatasan login, cookie aman, dan batas upload. Rencanakan ulang backup dan uji
pemulihan sebelum data penting mulai digunakan.

Referensi: [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/),
[image PostgreSQL](https://hub.docker.com/_/postgres),
[Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).
