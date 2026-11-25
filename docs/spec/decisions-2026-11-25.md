# Keputusan pemilik proyek — 25 November 2026

Lanjutan dari [decisions-2026-11-24.md](decisions-2026-11-24.md). Keputusan ini menjawab pertanyaan aturan roster/OS dari uji browser (#13, #18, #19).

| No. | Topik | Keputusan |
|---|---|---|
| D14 | Rumus OS overstay (#18) | Rumus sistem lama adalah **aturan resmi**: OS = hari lebih di site × (hari off ÷ hari kerja) sesuai pola roster, lewat `calculate_overstay_os_days`. Pembulatan: 4:2 dan 5:2 dibulatkan ke bawah; 6:2, 8:2, 10:2 dibulatkan ke atas bila sisa lebih dari setengah. Tidak ada batas minimum/maksimum. Pola roster lain ditolak. Dikunci oleh tes di `operations.integration.ts` |
| D15 | Roster setelah Early Recall (#19) | **Tetap terpisah**, seperti sistem lama. Early Recall yang selesai (`OS_GENERATED`) tidak mengubah cycle roster; HR/GA tetap melakukan Confirm Return / D1 di halaman Roster & OS. UI Early Recall menampilkan pengingat ini |
| D16 | Arti OS dari Early Recall (#13) | OS adalah **perpanjangan/tambahan hari cuti**. Jika karyawan dipanggil kembali sebelum cutinya habis, sisa cuti disimpan sebagai OS untuk cuti berikutnya, dan **kedaluwarsa setelah 3 cycle** (sistem sudah menerapkan: cycle 0–3, `EXPIRED` di cycle 4). Karena sisa cuti satu periode hanya ada sekali, satu periode cuti hanya boleh dikonversi menjadi OS satu kali (dasar PR #24). Sisa cuti dihitung **inklusif**, tanggal kembali ikut dihitung: `os_generated_days = approved_leave_end − actual_return_date + 1`. Contoh: cuti selesai tanggal 30, kembali tanggal 28 → **3 hari** (28, 29, 30). Ini sama dengan perilaku sistem lama |
