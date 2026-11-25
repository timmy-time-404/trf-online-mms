# Roster dan saldo OS

Sumber: `supabase/functions/roster-operations/index.ts` (ada di repo), dengan logika inti di fungsi SQL (RPC) yang **tidak ada di repo**. [kode] + [DB?]

> Arti resmi singkatan **OS** belum dikonfirmasi. Dari UI, OS adalah saldo hari yang terbentuk dari *Overstay*, *Early Recall*, atau *adjustment* HR, dan dipakai dengan urutan FIFO.

## Konsep

- **Site cycle** (`employee_site_cycles`): satu siklus kerja karyawan, dari keluar site, mulai cuti, sampai kembali ke site.
- **OS ledger** (`employee_os_ledger`): catatan saldo OS per karyawan. Saldo bertambah dari overstay, Early Recall, atau adjustment, dan berkurang saat dipakai. Pemakaian mengikuti urutan FIFO (`consume_employee_os_fifo`).
- **Attention queue**: daftar siklus yang butuh tindakan per tanggal tertentu (`get_roster_attention_queue`).

## Aksi dan peran

`ACTION_ROLES` di Edge Function. [kode]

| Aksi | Peran | RPC database |
|---|---|---|
| `my_summary`: roster dan saldo OS milik sendiri | EMPLOYEE | `get_my_roster_os_summary` |
| `queue`: daftar yang perlu ditindaklanjuti | GA, HOD, HR, SUPER_ADMIN | `get_roster_attention_queue` |
| `os_ledger`: riwayat OS | HOD, HR, SUPER_ADMIN | query `employee_os_ledger` |
| `os_adjustment_options` | HR, SUPER_ADMIN | — |
| `confirm_site_out`: konfirmasi tanggal keluar site aktual | GA, HR, SUPER_ADMIN | `confirm_employee_actual_site_out` |
| `confirm_leave_start`: konfirmasi mulai cuti | GA, HR, SUPER_ADMIN | `confirm_employee_leave_start` |
| `confirm_return`: konfirmasi kembali ke site | GA, HR, SUPER_ADMIN | `confirm_employee_return_to_site` |
| `consume_os`: pakai saldo OS | HR, SUPER_ADMIN | `consume_employee_os_fifo` |
| `adjust_os`: koreksi saldo OS | HR, SUPER_ADMIN | `adjust_employee_os` |

HOD hanya melihat data department-nya. Pembatasan ini dilakukan di server berdasarkan sesi. [kode] `supabase/functions/_shared/appSessionAuth.ts`

## Manpower dashboard

Snapshot jumlah karyawan di site, sedang cuti, dan seterusnya, dari RPC `get_manpower_dashboard_snapshot`. Dibatasi per peran dan department di server. [kode] `supabase/functions/manpower-dashboard/index.ts`

## Employee management (HR)

Onboarding karyawan sekaligus akun, edit, aktif/nonaktif, dan reset password sementara, melalui RPC `create_employee_onboarding`, `update_employee_management`, `set_employee_management_active`, `reset_employee_temporary_password`, dan `list_employee_management_records`. [kode] `supabase/functions/employee-management/index.ts`

Rumus pasti (berapa hari OS dari overstay, aturan FIFO, validasi tanggal) ada di fungsi SQL dan harus diambil dari schema. [DB?]

## Tanggal aktual tidak boleh di masa depan (#12)

Sejak migrasi `0008_actual_dates_not_future`, Actual Site In, Actual Site Out, Actual Leave Start, dan Actual Leave End tidak boleh lebih dari tanggal bisnis hari ini (WITA). Pengecekan ada di trigger `validate_employee_site_cycle`, sehingga berlaku untuk semua konfirmasi movement dan OS overstay tidak terbentuk untuk hari yang belum terjadi. Sistem lama menerima tanggal masa depan.
