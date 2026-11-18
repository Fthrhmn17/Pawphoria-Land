DEPLOY PAWPHORIA LAND KE RAILWAY
================================

1. Buat repository GitHub baru, misalnya pawphoria-land.
2. Extract ZIP ini, lalu upload seluruh isi folder project ke repository GitHub (jangan upload ZIP sebagai satu file).
3. Di Railway pilih New Project > Deploy from GitHub Repo, lalu pilih repository.
4. Buka service aplikasi > Settings > Networking > Generate Domain.
5. Buka service > Variables, tambahkan:
   DB_PATH=/data/pawphoria.db
   SESSION_SECRET=buat-random-secret-panjang-dan-rahasia
6. Buka service > Volumes, buat volume dengan Mount Path /data.
7. Pastikan volume terpasang ke service aplikasi, lalu deploy/redeploy.
8. Buka domain Railway yang sudah dibuat.

LOGIN DEMO:
admin / admin

PENTING:
- Ganti password admin sebelum website dipakai publik.
- Pastikan DB_PATH=/data/pawphoria.db dan Volume mount /data benar. Tanpa volume, data SQLite bisa hilang saat container dibuat ulang.
- Railway memerlukan akun dan paket/kuota sesuai pemakaian. Cek harga dan batas pemakaian di Railway.
- Pembayaran masih manual; Midtrans/Xendit belum terhubung.
- Ini MVP untuk pengujian awal, bukan sistem pembayaran produksi yang sudah diaudit.
- Jangan masukkan SESSION_SECRET ke repository publik.
