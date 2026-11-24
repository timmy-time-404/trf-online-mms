# Early Recall

Pemanggilan kembali karyawan ke site **sebelum cuti yang disetujui selesai**. Sisa hari cuti yang tidak terpakai menjadi saldo **OS** (lihat [roster-os.md](roster-os.md)).

> ⚠️ Logika server Early Recall ada di Edge Function `early-recall` yang **tidak ada di repo**. Yang terdokumentasi di sini berasal dari kontrak API (`apps/web/src/lib/earlyRecallApi.ts`) dan aturan tombol di UI (`apps/web/src/features/early-recall/EarlyRecallDetailPage.tsx`). Transisi status pasti di server perlu dikonfirmasi. [DB?]

## Data utama

`recall_number`, karyawan, department, TRF sumber (`source_trf_id`) dan TRF terhubung (`linked_trf_id`), periode cuti yang disetujui (`approved_leave_start/end/days`), `proposed_return_date`, perkiraan hari cuti terpakai dan sisa, `actual_return_date`, `actual_leave_days_used`, `unused_leave_days`, `reason`, jejak siapa dan kapan per tahap, serta `os_generated_days` dan `os_ledger_id`.

## Status

`DRAFT` → `PENDING_HR_VALIDATION` → (`HR_VALIDATED`) → `PENDING_PM_APPROVAL` → `PM_APPROVED` → `GA_PROCESSING` → `TRAVEL_BOOKED` → `RETURNED_TO_SITE` → `OS_GENERATED`

Cabang: `NEEDS_REVISION`, `REJECTED`, `CANCELLED`. Status akhir: `OS_GENERATED`, `REJECTED`, `CANCELLED` (`isEarlyRecallTerminalStatus`).

`HR_VALIDATED` ada di daftar status, tetapi tidak ada tombol yang menunggu status itu. Kemungkinan validasi HR langsung memindahkan ke `PENDING_PM_APPROVAL`. [DB?]

## Aksi dan siapa yang boleh (aturan tombol di UI)

| Aksi API | Peran | Status saat aksi |
|---|---|---|
| `create`, `update`, `submit` | HOD, PM, SUPER_ADMIN | `DRAFT`, `NEEDS_REVISION` |
| `hr_validate` | HR, SUPER_ADMIN | `PENDING_HR_VALIDATION` |
| `pm_approve` | PM, SUPER_ADMIN | `PENDING_PM_APPROVAL` |
| `return_revision`, `reject` | HR di `PENDING_HR_VALIDATION`; PM di `PENDING_PM_APPROVAL`; SUPER_ADMIN di keduanya | |
| `ga_start` | GA, SUPER_ADMIN | `PM_APPROVED` |
| `travel_booked` | GA, SUPER_ADMIN | `PM_APPROVED`, `GA_PROCESSING` |
| `acknowledge` | EMPLOYEE (karyawan ybs.), sekali saja | `PM_APPROVED`, `GA_PROCESSING`, `TRAVEL_BOOKED` |
| `confirm_return` | GA, HR, SUPER_ADMIN | `TRAVEL_BOOKED`. Mengisi tanggal kembali aktual, lalu sistem membentuk OS |
| `cancel` | HOD di `DRAFT`/`PENDING_HR_VALIDATION`/`NEEDS_REVISION`; peran lain sesuai aturan di halaman detail | Selain status akhir dan `RETURNED_TO_SITE` |

Daftar dan detail Early Recall sudah **difilter per peran di server** (Edge Function), berbeda dengan TRF. [kode] `apps/web/src/layout/MainLayout.tsx`

## Perhitungan

Hari cuti dihitung inklusif (tanggal mulai dan selesai ikut dihitung). `calculateInclusiveDays` di `EarlyRecallFormPage.tsx`. [kode] Rumus OS yang terbentuk (`os_generated_days`) dihitung di server. [DB?]

## Tanggal kembali aktual (#12)

Sejak migrasi `0008_actual_dates_not_future`, `confirm_return` menolak Actual Return Date yang lebih dari tanggal bisnis hari ini (WITA), di samping syarat lama (setelah awal cuti dan tidak melewati akhir cuti). OS baru terbentuk setelah karyawan benar-benar kembali. Sistem lama menerima tanggal masa depan.

## Satu periode cuti hanya sekali menjadi OS (#13)

Sejak migrasi `0009_early_recall_os_overlap`, `create` dan `update` menolak periode approved leave yang tumpang tindih dengan Early Recall karyawan yang sama yang sudah `OS_GENERATED` ("Periode cuti ini sudah pernah dikonversi menjadi OS (ER-...)"). Recall `REJECTED` dan `CANCELLED` tidak menghalangi. Sistem lama hanya melarang dua recall aktif bersamaan, sehingga cuti yang sama bisa menghasilkan OS dua kali.

> Status: menunggu konfirmasi pemilik proses (lihat issue #13) sebelum dirilis ke `main`.
