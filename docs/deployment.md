# Deployment lingkungan pengembangan

## Status dan batas penggunaan

Konfigurasi `deploy/compose.yaml` menyiapkan PostgreSQL 17, API Hono, dan gateway
Caddy. Image gateway membangun React dengan `VITE_API_BASE_URL=/api`, menyajikan SPA,
dan meneruskan `/api/*` ke Hono pada origin yang sama. Autentikasi serta inti TRF
(daftar/detail, buat, edit, resubmit, hapus DRAFT), serta workflow approval memakai
PostgreSQL. Perubahan workflow, history, dan outbox berada dalam satu transaksi;
outbox belum dikirim. WP3 menambahkan master data, notifikasi in-app milik sendiri,
dan statistik dashboard. Onboarding HR penuh, roster, Early Recall, dan dokumen
masih menunggu paket berikutnya.
Konfigurasi ini hanya untuk pengujian fitur yang telah dimigrasi; bukan bukti paritas seluruh sistem.
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
docker compose --env-file deploy/.env -f deploy/compose.yaml build api gateway
docker compose --env-file deploy/.env -f deploy/compose.yaml up -d --wait --wait-timeout 120
docker compose --env-file deploy/.env -f deploy/compose.yaml ps
curl --fail http://127.0.0.1:8080/api/health
```

Script secret tidak mengganti password yang sudah ada. PostgreSQL membaca
password awal dari file Compose secret; perubahan file tersebut setelah database
dibuat **tidak** merotasi password database. Jangan menaruh isi secret di log.
User `trf_owner` adalah administrator bootstrap; jangan gunakan untuk request API.
Hubungkan API ke database menggunakan overlay autentikasi setelah migrasi dan
provisioning role runtime, sesuai langkah di bawah.

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
menjadi anggota `trf_auth_runtime`, tanpa superuser atau update user. Migrasi `0002`
memberi akses baca employee serta CRUD terbatas TRF dan insert history; otorisasi
per akun diperiksa API. `provision-runtime` menyelaraskan password login DB dengan
file private `deploy/secrets/runtime_password`; jangan jalankan saat ada rotasi
password tanpa merencanakan restart API. File mount runtime dapat dibaca proses
non-root, sementara direktori host tetap mode 0700. File credential akun dummy
tetap mode 0600. Jangan memakai credential pemilik database pada API.

Endpoint `/api/auth/login`, `/me`, dan `/logout` memakai cookie Secure/HttpOnly,
Origin yang tepat untuk mutasi, expiry bergeser 30 menit dengan batas 12 jam,
dan pembatasan percobaan login per identifier. Belum ada perubahan password atau
undangan. `VITE_API_BASE_URL=/api` mengaktifkan adapter cookie frontend untuk uji
integrasi; modul bisnis yang belum dimigrasi mengembalikan error eksplisit.
Inti TRF dan workflow WP2 bisa diuji setelah rilis terkait diterapkan; modul WP3–WP5 belum tersedia.

Uji integrasi WP1 memakai database PostgreSQL terpisah yang namanya berakhiran
`_test`, dengan administrator yang dapat menjalankan migrasi dan membuat role uji:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db createdb -U trf_owner trf_wp1_test
DB_NAME=trf_wp1_test docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm db-tools node dist/modules/trf/integration.js
```

Harness menjalankan API dengan koneksi role terbatas, menguji tujuh peran,
konflik status, rollback history, dan sesi invalid, lalu menghapus fixture miliknya.
Untuk PostgreSQL lokal, set `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_NAME`,
`DB_PASSWORD_FILE`, dan `DB_MIGRATIONS_DIR`, jalankan build shared lalu
`pnpm --filter @trf/api test:integration`.

WP2 memakai database disposable lain yang belum memiliki user aplikasi, karena
tes skip-approver mengubah status aktif semua fixture peran di database tersebut:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db createdb -U trf_owner trf_wp2_test
DB_NAME=trf_wp2_test docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm db-tools node dist/modules/trf/workflow.integration.js
```

Untuk PostgreSQL lokal dengan variabel koneksi yang sama dan `DB_NAME=trf_wp2_test`,
jalankan `pnpm --filter @trf/api test:workflow`. Migrasi `0003_trf_workflow` menambah
outbox, indeks pending, dan grant terbatas. Jangan mengubah migrasi WP1 yang sudah dirilis.
Upload masih ditunda hingga WP5; pengujian GA sementara dapat menyelesaikan proses
dengan metadata dokumen kosong. Outbox memakai nomor employee dari DB; worker WP5
wajib menangani nomor kosong dan membatasi pengiriman ke nomor uji yang disetujui.

WP3 memerlukan migrasi `0004_master_data` sebelum image API baru diaktifkan.
Migrasi menambah tabel hotel minimal dan grant kolom terbatas untuk master data.
CREATE user mengembalikan password acak sekali kepada SUPER_ADMIN; password tidak
tersimpan di state bisnis/localStorage dan hanya hash Argon2id disimpan di DB.
User baru tetap wajib mengganti password, sementara endpoint ganti password
menunggu WP4. DELETE user berarti nonaktif dan mencabut semua sesi, bukan hapus fisik.

```sh
docker compose --env-file deploy/.env -f deploy/compose.yaml exec -T db createdb -U trf_owner trf_wp3_test
DB_NAME=trf_wp3_test docker compose --env-file deploy/.env -f deploy/compose.yaml run --rm db-tools node dist/master-data.integration.js
```

Untuk PostgreSQL lokal gunakan `DB_NAME=trf_wp3_test` dengan variabel koneksi yang
sama, lalu `pnpm --filter @trf/api test:master-data`. Harness memerlukan database
disposable tanpa user aplikasi. CI menjalankan regresi WP1, WP2, dan WP3 pada DB terpisah.
Data kamar contoh statis dihapus. CRUD hotel menyimpan nama/kapasitas opsional;
okupansi belum dihitung karena belum ada sumber dan aturan yang disepakati.

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

## Syarat sebelum pemakaian seluruh fitur

Migrasikan autentikasi, otorisasi per role, TRF, approval, GA, early recall,
roster/OS, dokumen, serta notifikasi dan verifikasi terhadap spesifikasi lama.
Siapkan satu akun per role, termasuk `superadmin` dan `adm_hrmd_01`, dengan password
sementara berbeda; kewajiban ganti password akun dummy ditunda selama pengujian.
Siapkan fixture yang saling terhubung.
Pengiriman WhatsApp uji wajib dibatasi di backend ke dua nomor yang disetujui
pemilik; layanan pengiriman belum dikonfigurasi pada fondasi ini.

Domain terbaru yang dikonfirmasi pemilik adalah `meong-mms.org`.
Gateway TLS untuk uji WP1 memakai overlay berikut setelah build dan migrasi:

```sh
# Set APP_DOMAIN=meong-mms.org di deploy/.env, pastikan A/AAAA benar dan port 80/443 tersedia.
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.auth.yaml -f deploy/compose.domain.yaml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yaml -f deploy/compose.auth.yaml -f deploy/compose.domain.yaml up -d --wait
curl -I http://meong-mms.org/
curl -i https://meong-mms.org/
curl --fail https://meong-mms.org/api/health
```

Caddy menyimpan sertifikat di volume persisten. Jangan hapus volume TLS saat rilis.
Pastikan record AAAA tidak menunjuk ke hosting lain. Untuk VPS yang baru memakai
IPv4 ini, hapus AAAA lama pada domain utama sampai IPv6 VPS dikonfigurasi dan diuji.
Health check kontainer TLS hanya liveness, bukan validitas sertifikat. Respons root
menjadi 200 saat image frontend terpasang; health API 200 tidak membuktikan paritas bisnis.
Overlay ini belum menambahkan pembatasan akses penguji ketika fitur diaktifkan.

Sebelum fitur diaktifkan untuk penguji: siapkan pembatasan akses penguji,
pembatasan login, cookie aman, dan batas upload. Rencanakan ulang backup dan uji
pemulihan sebelum data penting mulai digunakan.

Referensi: [Compose secrets](https://docs.docker.com/compose/how-tos/use-secrets/),
[image PostgreSQL](https://hub.docker.com/_/postgres),
[Caddy reverse proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy).

## Catatan rilis

Hapus folder source lama sebelum mengekstrak arsip rilis (`rm -rf apps packages db`), supaya file yang sudah dihapus di Git tidak ikut ter-build. Jangan hapus `deploy/.env` dan `deploy/secrets`. Ambil `pg_dump -Fc` ke `/opt/trf-dev/backups` sebelum menjalankan migrasi.

## Audit setelah rilis

Jalankan audit end-to-end per role lewat domain (membuat data dummy):

```sh
cd /opt/trf-dev/foundation
docker run --rm -u 0 -v $PWD/deploy/smoke/domain-smoke.mjs:/s.mjs:ro -v $PWD/deploy/secrets/dummy-accounts.json:/a.json:ro --entrypoint node trf-api:$RELEASE_TAG /s.mjs https://meong-mms.org
```

Exit code 0 berarti semua pemeriksaan lulus.
