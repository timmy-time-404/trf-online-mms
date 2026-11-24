# Data dan validasi TRF

## Isi TRF

| Bagian | Field | Catatan |
|---|---|---|
| Karyawan | `employee_id`, `department` | Department TRF diambil dari karyawan dan dipakai untuk filter Admin Dept dan HOD |
| Tujuan perjalanan | `purpose_entries[]`: `travelPurpose`, `startDate`, `endDate`, `purposeRemarks` | Bisa lebih dari satu. `travelPurpose` disimpan sebagai **string JSON berisi array key**, misalnya `'["FIELD_BREAK","TRAINING"]'`. Data lama berupa satu key biasa |
| Tujuan (lama) | `travel_purpose`, `start_date`, `end_date`, `purpose_remarks` | Kolom lama tetap diisi dan dibaca kalau `purpose_entries` kosong |
| Akomodasi | `accommodations[]`: `hotelName`, `checkInDate`, `checkOutDate`, `remarks` | Kolom lama `accommodation` (satu objek) dipakai kalau array kosong |
| Perjalanan | `travel_arrangements[]`: `travelType` (`TRAVEL_IN`/`TRAVEL_OUT`), `arrangementType` (`BY_SITE_SERVICE`/`SELF_ARRANGEMENT`), `transportation` (`FLIGHT`/`TRAIN`/`CAR`/`SHIP`/`SELF_ARRANGEMENT`), `travelDate`, `fromLocation`, `toLocation`, `specialArrangement`, `justification`, `remarks` | Disimpan sebagai JSON |
| Approval | `admin_dept_verify`, `parallel_approval.hod/hr`, `pm_approval`, `ga_process` | Objek JSON berisi siapa, kapan, dan remarks |
| Lumpsum | `lumpsum_amount`, `lumpsum_currency` (`IDR`), `lumpsum_note`, `lumpsum_input_by`, `lumpsum_input_at` | Diisi HR saat approve |
| Dokumen GA | `ga_documents` | Map nama → `{ name, url, path }` di Supabase Storage |

Sumber: `apps/web/src/types/index.ts`, `apps/web/src/store/index.ts` (`transformTRFFromDB`). [kode]

## Validasi form

`apps/web/src/lib/trfValidation.ts`. [kode] Untuk setiap entri tujuan perjalanan:

1. Minimal satu entri.
2. Minimal satu tujuan dipilih, dan semua key harus ada di daftar resmi.
3. Tanggal mulai dan selesai wajib diisi, berformat `YYYY-MM-DD`, dan berupa tanggal kalender yang valid.
4. Tanggal selesai ≥ tanggal mulai.
5. Remarks wajib diisi.

Tidak ada validasi H-14, tidak ada validasi tanggal relatif terhadap hari ini, dan tidak ada validasi bahwa tanggal check-in/out atau tanggal perjalanan berada dalam rentang tujuan.

## Daftar tujuan perjalanan

`apps/web/src/constants/travelPurposeOptions.ts`, berisi 22 key: `ANNUAL_LEAVE`, `FIELD_BREAK`, `TRAINING`, `BUSINESS_TRIP`, `INBOUND`, `OUTBOUND`, `NEW_HIRE_INBOUND`, `SICK_LEAVE`, `UNPAID_LEAVE`, `CUTI_BAPTIS_KHITANAN`, `CUTI_BESAR`, `CUTI_HAID`, `CUTI_KEGUGURAN`, `CUTI_MELAHIRKAN_ISTRI`, `CUTI_MELAHIRKAN_WANITA`, `CUTI_MENIKAH`, `CUTI_MENIKAHKAN_ANAK`, `CUTI_MENINGGAL_KELUARGA_BESAR`, `CUTI_MENINGGAL_KELUARGA_INTI`, `CUTI_NAIK_HAJI`, `CUTI_PANJANG`, `OTHERS`. [kode]

## Lumpsum HR

`apps/web/src/lib/lumpsumOptions.ts`. Nominal hanya boleh salah satu dari 17 nilai berikut (IDR): 75.000, 150.000, 200.000, 275.000, 300.000, 375.000, 400.000, 450.000, 500.000, 575.000, 600.000, 675.000, 700.000, 750.000, 800.000, 875.000, 1.000.000. [kode]

Aturan penentuan nominal mana yang tepat untuk suatu perjalanan **tidak ada di sistem**. HR memilih secara manual. Apakah ada tabel acuan resmi (misalnya berdasarkan level atau tujuan)?

## Ekspor

- **PDF** per TRF: dibuat di browser (html2canvas + jsPDF) dengan format formulir perusahaan. `apps/web/src/utils/exportTRFToPDF.ts`
- **Excel** per TRF dan semua TRF: dibuat di browser (`xlsx`). `apps/web/src/utils/exportTRFToExcel.ts`, `exportAllTRFsToExcel.ts`
