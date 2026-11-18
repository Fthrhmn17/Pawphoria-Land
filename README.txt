PAWPHORIA LAND — TICKETING SYSTEM (MVP)
======================================

Kebutuhan:
- Node.js 20 LTS atau lebih baru
- npm

CARA MENJALANKAN:
1. Extract ZIP.
2. Buka terminal di folder pawphoria-land-system.
3. Jalankan: npm install
4. Jalankan: npm start
5. Buka: http://localhost:3000

HALAMAN:
- Website publik: http://localhost:3000
- Pemesanan tiket: http://localhost:3000/booking.html
- Admin: http://localhost:3000/admin.html

LOGIN DEMO:
- Username: admin
- Password: admin

Database SQLite otomatis dibuat di folder data/pawphoria.db.
Jangan hapus file database setelah mulai digunakan.

FITUR YANG SUDAH ADA:
- Website publik responsif
- Guest checkout tanpa login
- Katalog tiket aktif
- Pembuatan order dan pengecekan kuota
- Promo code dengan kuota dan diskon nominal/persen
- Admin login berbasis session
- Dashboard transaksi
- Ticket categories dan ticket master
- Activity master
- Promo & invitation code master
- Verifikasi pembayaran manual
- QR ticket dibuat setelah order diverifikasi PAID
- Check-in satu kali per order
- Pencatatan pengeluaran dan ringkasan keuangan
- SQLite database persisten

BATASAN MVP / SEBELUM GO-LIVE:
- Pembayaran masih manual reference + verifikasi admin. Midtrans/Xendit memerlukan akun merchant, server key, client key, callback/webhook dan pengujian sandbox.
- QR dihasilkan setelah admin mengubah order menjadi PAID. Untuk operasional, tambahkan scanner kamera dan mekanisme check-out/re-entry.
- Invitation code saat ini menggunakan mekanisme diskon; complimentary ticket dengan kuota terpisah perlu disempurnakan sebelum operasional.
- Belum ada pengiriman e-ticket otomatis via WhatsApp/email.
- Belum ada role partner terpisah, split profit otomatis, export laporan, maupun audit log lengkap untuk seluruh perubahan.
- Akun demo admin/admin wajib diganti. Session secret wajib diganti.
- Untuk produksi wajib HTTPS, backup database, rate limiting, validasi tambahan, proteksi CSRF, pengamanan session, dan konfigurasi hosting.

PENTING:
Ini adalah MVP yang dapat dijalankan secara lokal untuk uji alur dan pengembangan. Jangan gunakan untuk menerima pembayaran publik sebelum integrasi payment gateway, keamanan, dan UAT diselesaikan.
