# Changelog & Progres Deployment — f&b1621

Dokumen ini mencatat seluruh riwayat progres, keputusan teknis, kendala yang terselesaikan, serta sisa pekerjaan proses rilis produksi aplikasi **f&b1621** berdasarkan acuan [`plan_deploy_new.md`](plan_deploy_new.md).

---

## Ringkasan Status Saat Ini

- **Pembaruan Terakhir:** 24 November 2026, 22:00 WIB
- **Server Produksi:** VPS Hostinger KVM 2 (`213.190.4.98` / `srv2193752.hstgr.cloud` — Ubuntu 26.04 LTS)
- **Progres Fase:**
  - [x] **Persiapan Dokumen & Audit Deploy** (Selesai 24 Nov 2026)
  - [x] **Fase 1: VPS Hostinger & DNS Domain** (Selesai 24 Nov 2026)
  - [x] **Fase 2: Hardening VPS & Setup Coolify HTTPS** (Selesai 24 Nov 2026)
  - [ ] **Fase 3: Persiapan Project Supabase Produksi** *(Target berikutnya)*
  - [ ] **Fase 4: Konfigurasi & Deploy Aplikasi di Coolify**
  - [ ] **Fase 5: Verifikasi Pasca-Deploy, Backup, & Go-Live Toko**

---

## Log Perubahan & Progres Harian

### 24 November 2026 (17:22 – 22:00 WIB)

#### Yang Diselesaikan
1. **Audit `DEPLOYMENT.md` & Pembuatan `plan_deploy_new.md`**
   - Memetakan seluruh stack & tools terbaru (Next.js `15.2.0`, React `19.0.0`, Tailwind CSS v4, TanStack Query, Zod, Supabase PostgreSQL + Auth + Realtime + RLS, Resend API, Docker standalone, Coolify, Traefik + Let's Encrypt).
   - Mengidentifikasi 6 ketidaksesuaian pada [`DEPLOYMENT.md`](DEPLOYMENT.md) lama (jumlah migration yang kini 8 file, urutan nama `0006_cashier_shift_closing.sql`, bug Foreign Key `20261107000006` sebelum `seed.sql`, akses awal Coolify port `8000` yang terblokir UFW, Auth Site URL & role `warehouse` / modul baru, serta status `NEXT_PUBLIC_APP_URL` dan file lokal).
   - Menerbitkan [`plan_deploy_new.md`](plan_deploy_new.md) sebagai acuan deploy resmi.
2. **Setup VPS Hostinger & DNS Domain (Fase 1)**
   - VPS Hostinger KVM 2 (`213.190.4.98`) aktif dan berjalan.
   - Menambahkan DNS A Record untuk domain utama (`@`) dan subdomain panel (`coolify`) ke `213.190.4.98`.
   - Memverifikasi akses SSH ke VPS termasuk penambahan SSH key untuk device berbeda.
3. **Hardening Server & Setup Coolify HTTPS (Fase 2)**
   - Menjalankan [`deploy/vps-hardening.sh`](deploy/vps-hardening.sh): timezone `Asia/Jakarta`, update keamanan + `unattended-upgrades`, **UFW Firewall** (`22`, `80`, `443`), **Fail2ban**, dan instalasi **Coolify**.
   - Membuka UI onboarding Coolify via SSH tunnel (`localhost:8000`), membuat akun root Coolify, dan menyelesaikan koneksi server `Localhost`.
   - Mengatur **Instance's Domain** Coolify ke domain HTTPS sehingga dashboard Coolify kini dapat diakses langsung dari browser tanpa SSH tunnel.

#### Kendala yang Ditemui & Solusi
- **SSH `Connection timed out` dari jaringan kantor (`192.168.27.201`):** Firewall kantor memblokir koneksi keluar port `22`; diatasi dengan memakai jaringan non-kantor.
- **Coolify *Setup window closed* (>10 menit setelah instalasi):** Dibuka kembali dengan `docker restart coolify` di server.
- **Error validasi *need type A* saat mengatur domain Coolify:** Terselesaikan setelah DNS A Record terbaca mengarah ke `213.190.4.98`, lalu panel Coolify aktif di HTTPS.

---

## Sisa Pekerjaan (Next Session)

### Fase 3 — Persiapan Project Supabase Produksi
- [ ] Buat project Supabase baru khusus **Produksi** (`ap-southeast-1` Singapore, paket Pro) dan simpan `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, dan `SUPABASE_SERVICE_ROLE_KEY`.
- [ ] Jalankan **9 file SQL** di *SQL Editor* sesuai urutan anti-error di [`plan_deploy_new.md`](plan_deploy_new.md) (`000001`..`000005` → `0006_cashier_shift_closing.sql` → `seed.sql` → `000006` → `000007`), serta opsional bersihkan data demo.
- [ ] Aktifkan Supabase Realtime pada tabel `orders` dan `audit_logs`.
- [ ] Atur Auth **Site URL** dan **Redirect URLs** ke domain produksi, lalu buat user **Owner** pertama (`auth.users` + `public.profiles`).

### Fase 4 — Konfigurasi & Deploy Aplikasi di Coolify
- [ ] Pastikan seluruh perubahan & aset terbaru di repo GitHub `chairullinad/F-B1621` sudah di-push.
- [ ] Buat Resource baru dari GitHub di Coolify (Build Pack: `Dockerfile`, domain POS + **Force HTTPS**).
- [ ] Isi Environment Variables produksi dan centang **Build Variable** untuk `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- [ ] Pasang Healthcheck (`/api/health` port `3000`) dan 2 Scheduled Tasks (`/api/jobs/expire-orders` & `/api/jobs/monthly-report`), lalu klik **Deploy**.

### Fase 5 — Verifikasi, Backup, & Go-Live Toko
- [ ] Verifikasi `/api/health`, login Owner, dan tes Realtime order `/m/[token]` → `/kasir`.
- [ ] Aktifkan Daily Backups Supabase Pro dan Weekly Snapshot VPS Hostinger.
- [ ] Lengkapi setup operasional toko (profil outlet, QRIS, pajak/service charge, email Owner, menu, bahan baku & resep BOM, akun staf `cashier`/`warehouse`/`kitchen`/`waiter`, cetak 100 QR meja, dan pasang PWA di perangkat operasional).
