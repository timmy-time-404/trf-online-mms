# Peran dan hak akses

## Tujuh peran

| Peran | Siapa | Wajib punya department |
|---|---|---|
| `EMPLOYEE` | Karyawan pemilik TRF | Tidak (terhubung ke data `employees`) |
| `ADMIN_DEPT` | Admin departemen, memverifikasi TRF | **Ya** |
| `HOD` | Head of Department, approval tahap 1 | **Ya** |
| `HR` | Human Resources, approval tahap 2 dan lumpsum | Tidak |
| `PM` | Project Manager, approval terakhir | Tidak |
| `GA` | General Affairs, memesan tiket/hotel | Tidak |
| `SUPER_ADMIN` | Pengelola sistem, akses penuh | Tidak |

Sumber: `apps/web/src/types/index.ts`, `apps/web/src/App.tsx` (`requireDepartment`). [kode]

## TRF yang terlihat per peran

`getVisibleTRFs` di `apps/web/src/store/index.ts`. [kode]

| Peran | Melihat |
|---|---|
| EMPLOYEE | Hanya TRF dengan `employee_id` miliknya |
| ADMIN_DEPT, HOD | Hanya TRF dengan department yang sama (perbandingan tanpa beda huruf besar/kecil dan spasi di tepi) |
| HR, PM, GA, SUPER_ADMIN | Semua TRF |

## Halaman per peran

Sumber: `apps/web/src/App.tsx`. [kode]

| Halaman | Peran |
|---|---|
| `/` Dashboard, `/trf` daftar, `/trf/:id` detail, `/early-recall` daftar dan detail | Semua yang login |
| `/trf/new` buat TRF | EMPLOYEE, SUPER_ADMIN |
| `/trf/:id/edit` | EMPLOYEE (revisi), HR dan GA (edit saat approval), SUPER_ADMIN |
| `/verify` | ADMIN_DEPT, SUPER_ADMIN |
| `/approvals` | HOD, HR, PM, SUPER_ADMIN |
| `/process` | GA, SUPER_ADMIN |
| `/early-recall/new`, edit | HOD, PM, SUPER_ADMIN |
| `/my-roster` | EMPLOYEE |
| `/roster-operations` | GA, HOD, HR, SUPER_ADMIN |
| `/manpower-dashboard` | HOD, HR, PM, SUPER_ADMIN |
| `/employees` | HR, SUPER_ADMIN |
| `/hotels` | GA, SUPER_ADMIN |
| `/admin/users`, `/super-admin` | SUPER_ADMIN |
| `/reports`, `/settings` | Placeholder "Coming soon" |

## Login dan sesi

- Login memakai tabel `users` sendiri (bukan Supabase Auth). Sistem lama memakai Edge Function `app-session` dengan token di `localStorage`.
- **Backend baru:** `POST /auth/login` di `apps/api/src/auth.ts`. Sesi disimpan di cookie `__Host-trf-session` (HttpOnly, Secure). Sesi berakhir setelah 30 menit tidak aktif atau 12 jam sejak login, dan dicabut saat akun dinonaktifkan. Login dibatasi 10 percobaan gagal per username dan 30 per IP dalam 15 menit.
- Akun dengan `mustChangePassword = true` hanya boleh membuka `/change-password`. [kode] Di backend baru, API juga menolak semua endpoint lain dengan 403 kecuali `/auth/me` dan ganti password.
- Akun baru dibuat oleh User Management atau oleh HR melalui Employee Management, dan wajib mengganti password saat login pertama. [kode]
