# 0008. Notifikasi WhatsApp lewat outbox Postgres

- Status: Diterima
- Tanggal: 2026-11-23

## Konteks

Sistem lama memicu WhatsApp dari browser tanpa menunggu hasilnya, sehingga notifikasi bisa hilang tanpa jejak.

## Keputusan

1. Perubahan status dan baris `notification_outbox` ditulis dalam transaksi yang sama.
2. Worker di proses API mengambil baris yang belum terkirim (`FOR UPDATE SKIP LOCKED`), mengirimnya ke Fonnte, lalu mencatat hasilnya.
3. Kalau gagal, pengiriman dicoba ulang dengan jeda yang makin panjang dan batas jumlah percobaan.

## Alternatif yang ditolak

- **Kirim langsung saat request:** notifikasi hilang kalau Fonnte lambat atau gagal, atau terkirim untuk perubahan yang ternyata gagal disimpan.
- **Redis/NATS:** layanan tambahan yang tidak perlu untuk skala ini.

## Konsekuensi

Notifikasi dijamin terkirim minimal sekali, jadi pesan yang sama bisa saja terkirim dua kali dan isinya harus tetap aman kalau itu terjadi. Status pengiriman tercatat dan bisa diaudit.
