# Plan Deploy Baru — f&b1621 (POS, Inventory, & Akuntansi F&B Web)

Dokumen ini disusun sebagai **pembaruan menyeluruh** dari [`DEPLOYMENT.md`](DEPLOYMENT.md) agar sesuai dengan kondisi kode, skema database, dan kebutuhan infrastruktur terbaru di repository `chairullinad/F-B1621`.

Dokumen ini dibagi menjadi 3 bagian utama:
1. **Penjelasan Lengkap Stack & Tools Aplikasi**
2. **Audit Ketidaksesuaian `DEPLOYMENT.md` Lama vs Kondisi Repo Saat Ini**
3. **Plan Deploy Produksi Lengkap (Langkah demi Langkah dari Dashboard Hostinger)**

---

## 1. Penjelasan Lengkap Stack & Tools Aplikasi

### A. Front-End
- **Framework Utama:** Next.js `15.2.0` (App Router) dengan React `19.0.0` dan TypeScript `5.8.2` (`strict`).
- **Styling & Komponen UI:** Tailwind CSS v4 (`@tailwindcss/postcss` `4.0.9`), primitif komponen **Radix UI** (`dialog`, `label`, `select`, `slot`, `switch`, `tabs`), ikon **Lucide React** (`lucide-react`), toast notifikasi **Sonner** (`sonner`), dan font **Inter** via `next/font/google`.
- **Manajemen State & Utilitas Client:**
  - **TanStack Query** (`@tanstack/react-query` `5.66.9`) untuk sinkronisasi data server.
  - **jsQR** (`jsqr` `1.4.0`) untuk membaca payload string QRIS dari gambar QRIS statis di pengaturan outlet.
- **Peta Rute Halaman (`src/app/`):**
  - **Pelanggan (tanpa login):** `/m/[token]`
  - **Autentikasi Staf:** `/login`
  - **Operasional Staf:** `/kasir`, `/order-manual`, `/dapur`, `/antar`, `/struk/[orderId]`
  - **Dashboard Owner & Gudang (`/dashboard`):** `produk`, `kategori`, `meja`, `meja/cetak`, `transaksi`, `pengaturan`, `staf`, `audit`, `cabang`, `inventory`, `stok-menu`, `opname`, `waste`, `supplier`, `transfer-stok`, dan `keuangan` (Laporan Keuangan 5 Tab).
- **PWA (Progressive Web App):**
  - Manifest didefinisikan di `src/app/manifest.ts` (`/manifest.webmanifest`).
  - Service Worker di `public/sw.js` memakai mode *network pass-through* (tidak men-cache data transaksi/harga secara offline agar status order di kasir, dapur, pelayan, dan HP pelanggan selalu real-time dari server).

### B. Back-End (Next.js Server)
- **Server Actions & Business Logic (`src/server/`):** Seluruh logika bisnis dijalankan di server (`auth.ts`, `cashier.ts`, `cashier-shift.ts`, `customer-order.ts`, `kitchen-waiter.ts`, `manual-order-and-transactions.ts`, `master-data.ts`, `menu-stock.ts`, `inventory.ts`, `accounting.ts`, `dashboard-analytics.ts`, `outlets.ts`, `audit-trail.ts`, `owner-notifications.ts`, `order-expiry.ts`, `system-status.ts`).
- **Validasi & Proteksi Akses:**
  - Validasi input server memakai **Zod** (`3.24.2`).
  - Proteksi rute staf berdasarkan 5 role (`owner`, `cashier`, `warehouse`, `kitchen`, `waiter`) dijalankan di `src/middleware.ts` serta divalidasi ulang di server action dan RLS database.
- **API Route Handlers (`src/app/api/`):**
  - `GET /api/health` — endpoint healthcheck container (mengembalikan status `healthy` dan waktu server WIB).
  - `POST /api/jobs/expire-orders` — endpoint job kedaluwarsa otomatis order `PENDING` > 15 menit (dilindungi header `Authorization: Bearer <CRON_SECRET>`).
  - `POST /api/jobs/monthly-report` — endpoint job pengiriman laporan bulanan ke email Owner untuk setiap outlet (dilindungi `CRON_SECRET`).
- **Scheduler Internal Node.js:** `src/instrumentation.ts` otomatis menjalankan `runExpireOverdueOrdersJob()` setiap 30 detik di sisi server selama proses Next.js berjalan.
- **Layanan Email Transaksional:** `src/server/owner-notifications.ts` mengirim email laporan bulanan & peringatan kejadian sensitif melalui **Resend REST API** (`https://api.resend.com/emails`).

### C. Database, Auth, & Realtime
- **Platform:** **Supabase Cloud** (PostgreSQL 15 + Supabase Auth + Supabase Realtime + Row Level Security). Wajib memakai **2 project terpisah**: `dev` dan `produksi` (untuk produksi disarankan paket **Supabase Pro** agar project tidak auto-pause dan memiliki Daily Automated Backups / PITR).
- **Klien SDK:** `@supabase/supabase-js` (`2.49.1`) dan `@supabase/ssr` (`0.6.1`). Klien admin (`src/lib/supabase/admin.ts`) memakai `SUPABASE_SERVICE_ROLE_KEY` yang dilindungi paket `server-only`.
- **Keamanan & Audit Database:**
  - Row Level Security (`ENABLE` + `FORCE ROW LEVEL SECURITY`) aktif di seluruh tabel bisnis.
  - Ekstensi `pgcrypto` untuk token QR acak dan hash SHA-256.
  - Tabel `audit_logs` bersifat *append-only* (trigger dan RLS memblokir `UPDATE` dan `DELETE`, serta menyimpan rantai `prev_hash` dan `hash`).
  - Ekstensi opsional `pg_cron` (jika aktif di Supabase) didaftarkan pada migration `000005` untuk menjalankan `public.expire_overdue_pending_orders()` tiap menit.
- **Supabase Realtime (`postgres_changes`):**
  - Layar Kasir (`cashier-workspace.tsx`) berlangganan perubahan tabel **`orders`** dan **`audit_logs`** serta memakai Realtime Presence untuk deteksi kasir yang sedang membuka order.
  - Layar Dapur (`kitchen-board.tsx`) dan Layar Antar (`waiter-board.tsx`) berlangganan perubahan tabel **`orders`**.
- **Penyimpanan Gambar/Aset:**
  - Aplikasi **tidak** menggunakan Supabase Storage bucket. Logo & foto menu bawaan disajikan dari folder `public/` di container Docker, sedangkan upload foto menu/gambar poster QRIS dari dashboard disimpan sebagai URL/data URL pada database.

### D. Tools Infrastruktur & Deployment (Sesuai Plan Sebelumnya)
- **GitHub (`chairullinad/F-B1621`):** Repository sumber kode yang dihubungkan ke Coolify.
- **VPS Hostinger KVM 2 (Ubuntu 24.04 LTS):** Server produksi (2 vCPU, 8 GB RAM, 100 GB NVMe).
- **Hardening Server (`deploy/vps-hardening.sh`):**
  - `timedatectl` — mengunci zona waktu OS ke `Asia/Jakarta` (WIB).
  - **UFW (Uncomplicated Firewall)** — *deny incoming* default, hanya membuka port `22/tcp` (SSH), `80/tcp` (HTTP), dan `443/tcp` (HTTPS).
  - **Fail2ban** — melindungi port SSH dari serangan brute-force.
  - **Unattended Upgrades** — memperbarui patch keamanan Ubuntu secara otomatis.
- **Coolify (Self-Hosted PaaS):** Mengorkestrasi build Docker dari GitHub, manajemen Environment Variables, Healthcheck, Scheduled Tasks (Cron), serta **Traefik Reverse Proxy + SSL/TLS Let's Encrypt** otomatis.
- **Docker (`Dockerfile`):** Multi-stage build berbasis `node:22-alpine` (`deps` → `builder` → `runner`), menghasilkan build `output: "standalone"` (`next.config.ts`), berjalan sebagai user non-root `nextjs` pada port `3000`.

---

## 2. Audit Ketidaksesuaian `DEPLOYMENT.md` Lama vs Kondisi Repo Saat Ini

Dari hasil pengecekan menyeluruh antara `DEPLOYMENT.md` lama dengan kode & migration terbaru di repo, ditemukan **6 ketidaksesuaian** berikut:

1. **Jumlah File Migration Tidak Lengkap (Tercatat 5, Aktualnya 8 File)**
   - `DEPLOYMENT.md` lama hanya mencatat `20261107000001` s/d `20261107000005`.
   - Repo saat ini memiliki **3 migration tambahan**:
     - `supabase/migrations/20261107000006_fnb1621_inventory_and_accounting.sql` (role `warehouse`, master bahan baku, resep/BOM, mutasi stok, supplier & PO, stock opname, waste, transfer stok, jurnal akuntansi).
     - `supabase/migrations/20261107000007_multi_outlet_and_theme.sql` (kolom logo cabang, warna tema, multi-outlet).
     - `supabase/migrations/0006_cashier_shift_closing.sql` (indeks tutupan shift kasir di `audit_logs`).

2. **Anomali Penamaan Urutan `0006_cashier_shift_closing.sql`**
   - File `0006_cashier_shift_closing.sql` diawali angka `0006_`, sehingga jika diurutkan alfabetis di Explorer/CLI akan muncul **sebelum** `20261107000001_initial_schema.sql`.
   - Padahal isinya membuat indeks pada `public.audit_logs`, yang baru dibuat di `20261107000003_audit_trail.sql`. Jika dijalankan paling awal, SQL akan **gagal**.

3. **Bug Ketergantungan Foreign Key antara Migration `000006` dan `supabase/seed.sql` (KRITIS)**
   - `20261107000006_fnb1621_inventory_and_accounting.sql` (baris 339–526) langsung menyisipkan data awal (`ingredients`, `suppliers`, `purchase_orders`, `waste_logs`, `stock_transfers`, `accounting_journals`) dengan `outlet_id = '00000000-0000-0000-0000-000000001621'`.
   - Record outlet `'00000000-0000-0000-0000-000000001621'` baru dibuat oleh `supabase/seed.sql`!
   - Jika Anda mengikuti urutan `DEPLOYMENT.md` lama (jalankan semua migration dulu baru `seed.sql`) pada database produksi kosong, migration `000006` akan **gagal Foreign Key**.
   - Selain itu, `seed.sql` dan `000006` juga menyisipkan data demo (`LATTESPACE` lalu di-update menjadi `f&b1621`, 10 menu contoh, supplier/PO/jurnal fiktif `JV-001` s/d `JV-010`) yang perlu dibersihkan bila toko ingin mulai dari pembukuan Rp 0.

4. **Akses Dashboard Awal Coolify (Port `8000`) Terblokir UFW**
   - `DEPLOYMENT.md` lama menyuruh langsung menjalankan `sudo ./deploy/vps-hardening.sh` (yang mengaktifkan UFW dan memblokir semua port selain `22`, `80`, `443`), namun tidak menjelaskan cara membuka UI setup Coolify di port `8000` sebelum domain HTTPS terpasang, serta mengasumsikan repo sudah ada di VPS yang baru dibeli.

5. **Kekurangan Panduan Supabase Auth URL & Checklist Role/Modul Baru**
   - `DEPLOYMENT.md` lama belum menginstruksikan pengubahan **Site URL** dan **Redirect URLs** di Supabase Dashboard Produksi dari `http://localhost:3000` (seperti di `supabase/config.toml`) ke domain produksi.
   - Daftar role di checklist belum mencantumkan role **`warehouse` (Staff Gudang)**, serta belum mencakup setup awal **Multi-Cabang & Tema (`/dashboard/cabang`)**, **Bahan Baku & Resep BOM (`/dashboard/inventory`, `/dashboard/stok-menu`)**, **Supplier (`/dashboard/supplier`)**, dan **Tutupan Shift Kasir**.

6. **Ketidakcocokan Kecil Environment Variable & Status File Lokal**
   - `DEPLOYMENT.md` lama menuliskan `NEXT_PUBLIC_APP_URL` di daftar Environment Variable Coolify, padahal tidak ada kode di `src/` yang membaca `NEXT_PUBLIC_APP_URL` saat ini (aman bila tetap diisi, namun bukan variabel wajib).
   - Di root repo masih terdapat `vercel.json` (sisa konfigurasi Vercel; diabaikan oleh build `Dockerfile` Coolify).
   - Pada workspace lokal saat ini terdapat file/folder untracked (`foto-menu/` dan 2 file sticker `.png`). Coolify hanya mem-build kode yang sudah di-push ke GitHub `origin` (`chairullinad/F-B1621`).

---

## 3. Plan Deploy Produksi Baru (Langkah demi Langkah)

Berikut urutan eksekusi paling aman dimulai dari kondisi Anda saat ini (**sudah membeli domain & VPS Hostinger, dan sudah login ke dashboard Hostinger hPanel**).

### Fase 1: Setup Awal VPS & DNS Domain di Hostinger hPanel

1. **Siapkan OS VPS Hostinger KVM 2:**
   - Masuk ke menu **VPS** di hPanel Hostinger.
   - Pilih/reinstall OS menggunakan **Ubuntu 24.04 LTS (Plain OS)** — **jangan** memakai panel pihak ketiga (cPanel/CyberPanel/aaPanel) agar port `80` dan `443` kosong untuk Traefik Coolify.
   - Tambahkan **SSH Public Key** laptop Anda pada menu **SSH Keys** di hPanel (jika belum punya, buat di PowerShell laptop dengan `ssh-keygen -t ed25519` lalu salin isi `~\.ssh\id_ed25519.pub`).
   - Catat **Alamat IP Publik (IPv4)** VPS Anda.
   - Jika Hostinger menyediakan menu **Firewall** di level panel VPS, pastikan port `22`, `80`, dan `443` diizinkan.

2. **Arahkan DNS Domain ke IP VPS:**
   - Buka menu **Domains → Kelola → DNS / Nameservers (DNS Zone Editor)** di Hostinger.
   - Tambahkan **2 buah A Record** berikut (atau ganti `pos` dengan `@` bila memakai domain utama langsung):
     | Tipe | Name / Host | Points To (Value) | TTL | Kegunaan |
     | --- | --- | --- | --- | --- |
     | `A` | `pos` | `<IP_PUBLIC_VPS>` | Default / `300` | Aplikasi utama `https://pos.domainanda.id` |
     | `A` | `coolify` | `<IP_PUBLIC_VPS>` | Default / `300` | Panel admin `https://coolify.domainanda.id` |
   - **Penting:** Pastikan nama domain/subdomain aplikasi (`pos.domainanda.id`) sudah **final** sebelum Anda mencetak 100 stiker QR meja, karena URL di QR meja mengarah ke `https://pos.domainanda.id/m/<token>`.

---

### Fase 2: Hardening VPS & Instalasi Coolify + HTTPS

1. **Login ke VPS lewat SSH dari PowerShell laptop:**
   ```powershell
   ssh root@<IP_PUBLIC_VPS>
   ```

2. **Jalankan skrip hardening & instalasi Coolify:**
   - Karena VPS masih kosong, clone sementara repository ke `/tmp/fnb1621` (atau buat file `vps-hardening.sh` manual jika repo private) lalu eksekusi `deploy/vps-hardening.sh`:
     ```bash
     git clone https://github.com/chairullinad/F-B1621.git /tmp/fnb1621
     chmod +x /tmp/fnb1621/deploy/vps-hardening.sh
     sudo /tmp/fnb1621/deploy/vps-hardening.sh
     rm -rf /tmp/fnb1621
     ```
   - Skrip ini akan mengatur timezone ke `Asia/Jakarta`, update OS + pasang `unattended-upgrades`, mengaktifkan `fail2ban`, mengaktifkan UFW (hanya port `22`, `80`, `443`), lalu menginstal **Coolify**.

3. **Buka Panel Awal Coolify via SSH Tunnel (Aman Tanpa Membuka Port 8000 ke Publik):**
   - Buka terminal PowerShell baru di laptop Anda (jangan tutup terminal SSH pertama jika masih dipakai) dan buat SSH tunnel:
     ```powershell
     ssh -N -L 8000:127.0.0.1:8000 root@<IP_PUBLIC_VPS>
     ```
   - Di browser laptop, buka `http://localhost:8000`.
   - Buat akun Admin Coolify pertama Anda (gunakan email dan password kuat).
   - Saat onboarding Coolify, pilih **"This Machine"** (localhost server).

4. **Aktifkan Domain & HTTPS untuk Panel Coolify:**
   - Di dashboard Coolify, masuk ke **Settings → Configuration**.
   - Pada kolom **Instance's Domain**, isi: `https://coolify.domainanda.id` lalu klik **Save**.
   - Tunggu ~1–2 menit agar Traefik menerbitkan sertifikat SSL Let's Encrypt.
   - Tutup SSH tunnel (`Ctrl+C`) lalu akses `https://coolify.domainanda.id` untuk memastikan panel sudah berjalan di HTTPS dan port `8000` tetap aman tertutup dari internet.

---

### Fase 3: Persiapan Project Supabase Produksi (Urutan Anti-Error)

1. **Buat Project Supabase Produksi Baru:**
   - Buka [Supabase Dashboard](https://supabase.com/dashboard) dan buat project baru khusus **Produksi** (jangan gabungkan dengan project `dev`).
   - Pilih region **`ap-southeast-1` (Singapore)** dan paket **Pro** (agar tidak auto-pause dan punya *Daily Backups* / PITR).
   - Catat kredensial dari **Project Settings → API**:
     - `Project URL` (`NEXT_PUBLIC_SUPABASE_URL`)
     - `anon public` key (`NEXT_PUBLIC_SUPABASE_ANON_KEY`)
     - `service_role` secret key (`SUPABASE_SERVICE_ROLE_KEY`)

2. **Jalankan SQL Migration & Seed dengan Urutan Anti-Error:**
   - Buka menu **SQL Editor** di Supabase Dashboard Produksi, lalu jalankan file-file berikut **satu per satu sesuai urutan persis di bawah ini**:
     1. `supabase/migrations/20261107000001_initial_schema.sql`
     2. `supabase/migrations/20261107000002_rls_policies.sql`
     3. `supabase/migrations/20261107000003_audit_trail.sql`
     4. `supabase/migrations/20261107000004_qris_and_session_expiry.sql`
     5. `supabase/migrations/20261107000005_server_order_expiry_job.sql`
     6. `supabase/migrations/0006_cashier_shift_closing.sql` *(wajib setelah `000003` karena mengindeks `audit_logs`)*
     7. **`supabase/seed.sql`** *(wajib sebelum `000006` agar outlet `'00000000-0000-0000-0000-000000001621'` dan 100 meja sudah ada sebelum `000006` menyisipkan data inventory/supplier)*
     8. `supabase/migrations/20261107000006_fnb1621_inventory_and_accounting.sql`
     9. `supabase/migrations/20261107000007_multi_outlet_and_theme.sql`

3. **(Opsional tapi Direkomendasikan untuk Toko Nyata) Bersihkan Data Demo Awal:**
   - Karena `seed.sql` dan bagian akhir `20261107000006` membuat data contoh (10 menu contoh, supplier contoh, PO contoh, waste contoh, dan 10 jurnal dummy `JV-001` s/d `JV-010`), jika Anda ingin pembukuan & stok toko dimulai **bersih dari Rp 0**, jalankan query pembersihan ini di SQL Editor:
     ```sql
     DELETE FROM public.accounting_journals;
     DELETE FROM public.stock_transfers;
     DELETE FROM public.waste_logs;
     DELETE FROM public.purchase_orders;
     DELETE FROM public.stock_movements;
     DELETE FROM public.product_recipes;
     DELETE FROM public.ingredients;
     DELETE FROM public.suppliers;
     DELETE FROM public.products;
     DELETE FROM public.categories;
     ```
   - *(Data `outlets` dan 100 `tables` tetap dipertahankan supaya 100 QR meja siap dipakai dan nama outlet tinggal diubah di Dashboard).*

4. **Aktifkan Supabase Realtime:**
   - Masuk ke **Database → Replication** (atau **Publications → `supabase_realtime`**).
   - Pastikan tabel **`orders`** dan **`audit_logs`** dalam keadaan **ON / Enabled** (INSERT, UPDATE).

5. **Atur Auth URL Produksi & Buat Akun Owner Pertama:**
   - Masuk ke **Authentication → URL Configuration**:
     - Isi **Site URL** dengan `https://pos.domainanda.id`.
     - Tambahkan `https://pos.domainanda.id/**` ke **Redirect URLs**.
   - Masuk ke **Authentication → Users → Add user → Create new user** (isi email & password Owner, centang *Auto Confirm User*), salin `User UID`-nya.
   - Jalankan di SQL Editor untuk mendaftarkan profil Owner:
     ```sql
     INSERT INTO public.profiles (id, outlet_id, full_name, role, is_active)
     VALUES (
       '<USER_UID_OWNER_DARI_AUTH>',
       '00000000-0000-0000-0000-000000001621',
       'Owner f&b1621',
       'owner',
       true
     );
     ```
   - *(Akun staf lainnya — `cashier`, `warehouse`, `kitchen`, `waiter` — selanjutnya dibuat langsung oleh Owner dari UI `/dashboard/staf`).*

---

### Fase 4: Konfigurasi & Deploy Aplikasi di Coolify

1. **Pastikan Kode Terbaru Sudah di GitHub:**
   - Sebelum deploy, cek di laptop bahwa semua perubahan/aset yang ingin dirilis sudah di-commit dan di-push ke branch utama GitHub `chairullinad/F-B1621`.

2. **Buat Resource Aplikasi di Coolify:**
   - Buka **Projects → Default (atau buat project baru `fnb1621`) → + New Resource → Public/Private Repository (GitHub)**.
   - Pilih repository `chairullinad/F-B1621`.
   - Pilih **Build Pack:** `Dockerfile` (menggunakan `Dockerfile` di root repo).
   - Pada **Domains**, isi `https://pos.domainanda.id` dan pastikan **Force HTTPS** aktif (port aplikasi: `3000`).

3. **Isi Environment Variables di Coolify:**
   Buka tab **Environment Variables** dan masukkan variabel berikut:
   ```env
   NODE_ENV=production
   TZ=Asia/Jakarta
   NEXT_PUBLIC_SUPABASE_URL=https://<id-project-produksi>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-produksi>
   SUPABASE_SERVICE_ROLE_KEY=<service-role-key-produksi>
   CRON_SECRET=<string-acak-minimal-32-karakter>
   RESEND_API_KEY=<api-key-resend-anda>
   EMAIL_FROM=POS 1621 F&B <noreply@domainanda.id>
   ```
   - **WAJIB:** Centang opsi **Available at Buildtime (Build Variable)** untuk `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY` karena `Dockerfile` menyematkan keduanya saat `npm run build` (`ARG NEXT_PUBLIC_SUPABASE_URL`, `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   - **JANGAN** pernah mencentang Build Variable atau membagikan `SUPABASE_SERVICE_ROLE_KEY` ke sisi klien.
   - *(Catatan: Jika belum mendaftarkan domain di Resend, `RESEND_API_KEY` boleh dikosongkan sementara — sistem tetap mencatat log notifikasi secara lokal di `audit_logs` tanpa membuat aplikasi error).*

4. **Konfigurasi Healthcheck:**
   - Pada tab **Healthcheck** di Coolify:
     - **Enabled:** Ya
     - **Path:** `/api/health`
     - **Port:** `3000`
     - **Method:** `GET`

5. **Konfigurasi Scheduled Tasks (Cron):**
   - Pada tab **Scheduled Tasks** di resource aplikasi Coolify, tambahkan 2 tugas terjadwal:
     1. **Kedaluwarsa Order 15 Menit** (`* * * * *` — setiap 1 menit):
        ```bash
        curl -fsS -X POST http://127.0.0.1:3000/api/jobs/expire-orders -H "Authorization: Bearer $CRON_SECRET"
        ```
     2. **Laporan Bulanan Email Owner** (`0 7 1 * *` — tanggal 1 jam 07:00 WIB):
        ```bash
        curl -fsS -X POST http://127.0.0.1:3000/api/jobs/monthly-report -H "Authorization: Bearer $CRON_SECRET"
        ```

6. **Klik Deploy & Pantau Build Log:**
   - Klik **Deploy** di Coolify.
   - Pastikan tahap `npm ci`, `npm run build`, dan container start (`node server.js`) selesai tanpa error serta status berubah menjadi **Running (Healthy)**.

---

### Fase 5: Verifikasi Pasca-Deploy, Backup, & Checklist Go-Live Toko

1. **Verifikasi Teknis Awal:**
   - Buka `https://pos.domainanda.id/api/health` → pastikan merespons `{"ok":true,"status":"healthy",...}` dengan `serverTimeWib` sesuai WIB.
   - Login sebagai Owner di `https://pos.domainanda.id/login` → pastikan diarahkan ke `/dashboard`.
   - Uji koneksi Realtime: buka `/kasir` di satu tab dan `/m/<token-meja-1>` di HP/tab incognito, kirim 1 order uji coba lalu pastikan order muncul di `/kasir` dalam < 2 detik tanpa refresh. *(Batalkan order uji coba tersebut atau bersihkan sebelum toko buka).*

2. **Aktifkan Backup Produksi:**
   - **Database:** Pastikan **Daily Backups / PITR** aktif di project **Supabase Pro** produksi.
   - **VPS:** Aktifkan **Weekly Automated Snapshot** di panel VPS Hostinger sebelum atau sesudah rilis final.

3. **Checklist Operasional Toko Sebelum Dibuka ke Pelanggan:**
   - [ ] **Pengaturan Outlet (`/dashboard/pengaturan`):**
     - Isi Nama Restoran/Kafe, Alamat, Catatan Kaki Struk, dan Lama Kedaluwarsa Order (15 menit).
     - Unggah/tempel QRIS statis toko (`000201...`) dan aktifkan **Pembayaran QRIS di Meja**.
     - Atur Pajak & Service Charge (tetap mati jika toko tidak memungut, atau isi persentase terlebih dahulu baru nyalakan) serta batas diskon maksimum kasir.
     - Isi Email Owner dan aktifkan notifikasi email yang diinginkan.
   - [ ] **Tampilan & Cabang (`/dashboard/cabang`):** Pastikan logo cabang, warna tema, dan info outlet utama sudah sesuai.
   - [ ] **Master Menu, Bahan Baku, & Resep BOM:**
     - Input kategori (`/dashboard/kategori`) & daftar menu resmi (`/dashboard/produk`).
     - Input master bahan baku (`/dashboard/inventory`), supplier (`/dashboard/supplier`), dan resep/BOM tiap produk (`/dashboard/stok-menu`) agar auto-deduct stok & HPP berjalan saat order `PAID`.
   - [ ] **Akun Staf (`/dashboard/staf`):** Buat akun masing-masing staf dengan role yang tepat: `cashier` (Kasir), `warehouse` (Gudang), `kitchen` (Dapur), dan `waiter` (Pelayan).
   - [ ] **Cetak 100 QR Meja (`/dashboard/meja/cetak`):** Setelah domain final aktif di HTTPS, cetak 100 QR meja (atau nonaktifkan meja yang belum dipakai di `/dashboard/meja`).
   - [ ] **Pasang PWA di Perangkat Operasional:** Buka dari browser (Chrome/Safari) lalu pilih **Add to Home Screen** pada 5 perangkat kasir (`/kasir`), layar dapur (`/dapur`), dan HP pelayan (`/antar`).
