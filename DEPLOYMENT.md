# Panduan Deployment & Rilis Produksi — POS 1621 F&B Web

Dokumen ini berisi panduan langkah demi langkah untuk merilis aplikasi **POS 1621 F&B Web** ke lingkungan produksi sesuai [PRD.md](file:///d:/ooo/PROJECT%201621FNB/PRD.md) Bagian 10 & 11 dan [AGENTS.md](file:///d:/ooo/PROJECT%201621FNB/AGENTS.md).

---

## 1. Arsitektur Produksi

- **Server Aplikasi**: VPS **Hostinger KVM 2** (2 vCPU, 8 GB RAM, 100 GB NVMe, Ubuntu 24.04 LTS) dengan **Coolify**.
- **Database & Auth & Realtime**: Project **Supabase Produksi (Paket Pro)** di region terdekat (`ap-southeast-1` Singapore / Asia-Pacific) yang **terpisah sepenuhnya** dari project Supabase `dev`.
- **Domain & HTTPS**: Domain utama yang stabil (contoh: `pos.namarestoran.id`) dengan sertifikat SSL/TLS Let's Encrypt otomatis dari Coolify (Traefik).
  > **PENTING**: Pastikan domain produksi sudah final sebelum mencetak 100 stiker QR meja, karena seluruh QR meja mengarah ke `https://domain-anda.id/m/<token>`.

---

## 2. Persiapan Project Supabase Produksi

1. Buka [Supabase Dashboard](https://supabase.com/dashboard) dan buat project baru khusus **Produksi** (Paket **Pro** agar project tidak dijeda otomatis dan memiliki **Daily Backups**).
2. Buka menu **SQL Editor** pada project Supabase Produksi, lalu jalankan ke-5 file migration di folder `supabase/migrations/` secara berurutan:
   - [`supabase/migrations/20261107000001_initial_schema.sql`](file:///d:/ooo/PROJECT%201621FNB/supabase/migrations/20261107000001_initial_schema.sql)
   - [`supabase/migrations/20261107000002_rls_policies.sql`](file:///d:/ooo/PROJECT%201621FNB/supabase/migrations/20261107000002_rls_policies.sql)
   - [`supabase/migrations/20261107000003_audit_trail.sql`](file:///d:/ooo/PROJECT%201621FNB/supabase/migrations/20261107000003_audit_trail.sql)
   - [`supabase/migrations/20261107000004_qris_and_session_expiry.sql`](file:///d:/ooo/PROJECT%201621FNB/supabase/migrations/20261107000004_qris_and_session_expiry.sql)
   - [`supabase/migrations/20261107000005_server_order_expiry_job.sql`](file:///d:/ooo/PROJECT%201621FNB/supabase/migrations/20261107000005_server_order_expiry_job.sql)
3. Jalankan [`supabase/seed.sql`](file:///d:/ooo/PROJECT%201621FNB/supabase/seed.sql) untuk menginisialisasi 1 outlet dan 100 meja (`Meja 1` s/d `Meja 100`).
4. Di menu **Database -> Replication -> supabase_realtime**, pastikan tabel `orders` dan `audit_logs` sudah diaktifkan (*enabled*) untuk Realtime.
5. Buat akun pertama **Owner** di **Authentication -> Users**, lalu tambahkan baris profilnya ke `public.profiles` dengan `role = 'owner'`. Selanjutnya, Owner dapat membuat akun Kasir, Dapur, dan Pelayan langsung dari menu **Dashboard -> Staf & Role (`/dashboard/staf`)**.

---

## 3. Setup Keamanan VPS Hostinger KVM 2 & Instalasi Coolify

1. Masuk ke VPS menggunakan **SSH Key** (jangan gunakan password root).
2. Jalankan skrip otomasi keamanan dan instalasi Coolify [`deploy/vps-hardening.sh`](file:///d:/ooo/PROJECT%201621FNB/deploy/vps-hardening.sh):
   ```bash
   chmod +x deploy/vps-hardening.sh
   sudo ./deploy/vps-hardening.sh
   ```
   Skrip ini secara otomatis:
   - Mengatur zona waktu server ke `Asia/Jakarta` (WIB).
   - Mengonfigurasi **UFW Firewall** agar hanya membuka port `22/tcp` (SSH), `80/tcp` (HTTP), dan `443/tcp` (HTTPS).
   - Mengaktifkan **Fail2ban** dan **Unattended Upgrades** (update keamanan otomatis).
   - Menginstal **Coolify**.
3. Setelah skrip selesai, arahkan subdomain admin Coolify melalui HTTPS, lalu matikan akses port 8000 langsung jika sudah menggunakan domain proxy.

---

## 4. Konfigurasi Aplikasi di Coolify

1. Buat **New Resource -> Application -> Git Repository** di Coolify dan pilih repository proyek ini.
2. Pilih **Build Pack**: `Dockerfile` (menggunakan [`Dockerfile`](file:///d:/ooo/PROJECT%201621FNB/Dockerfile) di root proyek).
3. Atur **Domains**: masukkan `https://pos.domain-anda.id` dan aktifkan **Force HTTPS**.
4. Buka tab **Environment Variables** di Coolify (jangan pernah menyimpan kunci produksi di dalam repository Git):
   ```env
   NODE_ENV=production
   TZ=Asia/Jakarta
   NEXT_PUBLIC_APP_URL=https://pos.domain-anda.id
   NEXT_PUBLIC_SUPABASE_URL=https://<id-project-produksi>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<publishable-anon-key-produksi>
   SUPABASE_SERVICE_ROLE_KEY=<secret-service-role-key-produksi>
   CRON_SECRET=<string-acak-panjang-minimal-32-karakter>
   RESEND_API_KEY=<api-key-resend-untuk-email-owner>
   EMAIL_FROM="POS 1621 F&B <noreply@domain-anda.id>"
   ```
   > Centang opsi **Build Variable** untuk `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` agar disematkan saat tahap `npm run build` di Docker.
5. Pada tab **Healthcheck**, arahkan ke:
   - **Path**: `/api/health`
   - **Port**: `3000`
6. Pada tab **Scheduled Tasks (Cron)** di Coolify, tambahkan 2 jadwal berikut:
   - **Kedaluwarsa Order 15 Menit** (Setiap 1 menit: `* * * * *`):
     ```bash
     curl -fsS -X POST http://127.0.0.1:3000/api/jobs/expire-orders -H "Authorization: Bearer $CRON_SECRET"
     ```
     *(Selain cron ini, server Next.js juga menjalankan interval internal tiap 30 detik melalui [`src/instrumentation.ts`](file:///d:/ooo/PROJECT%201621FNB/src/instrumentation.ts) dan fungsi `pg_cron` di database).*
   - **Laporan Bulanan Email ke Owner** (Setiap tanggal 1 pukul 07:00 WIB: `0 7 1 * *`):
     ```bash
     curl -fsS -X POST http://127.0.0.1:3000/api/jobs/monthly-report -H "Authorization: Bearer $CRON_SECRET"
     ```

---

## 5. Strategi Backup & Pemulihan

1. **Backup Database Harian**: Aktif secara otomatis pada paket **Supabase Pro** (Point-in-Time Recovery / Daily Automated Backups).
2. **Snapshot VPS**: Aktifkan fitur **Weekly Automated Snapshot** pada panel Hostinger VPS sebelum melakukan pembaruan besar.

---

## 6. Checklist Akhir Sebelum Operasional Toko

- [ ] Login sebagai **Owner** di `https://pos.domain-anda.id/login`.
- [ ] Buka **Dashboard -> Pengaturan (`/dashboard/pengaturan`)**:
  - Isi Nama, Alamat, dan Catatan Kaki Struk outlet.
  - Tempelkan string payload QRIS statis toko (`000201...`) dan aktifkan **Pembayaran QRIS di Meja**.
  - Atur persentase Pajak & Service Charge (apabila toko memungut pajak/service charge) dan batas diskon maksimum kasir.
  - Isi **Alamat Email Owner** dan nyalakan pilihan Laporan Bulanan serta Kejadian Sensitif.
- [ ] Buka **Dashboard -> Produk & Kategori** untuk memasukkan daftar menu dan harga asli toko.
- [ ] Buka **Dashboard -> 100 Meja & Cetak QR (`/dashboard/meja/cetak`)** untuk mencetak 100 kode QR meja.
- [ ] Pasang aplikasi sebagai **PWA (Add to Home Screen)** pada 5 perangkat kasir (`/kasir`), layar dapur (`/dapur`), dan HP pelayan (`/antar`).

