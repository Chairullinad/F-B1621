# Rekapitulasi Detail Deployment Malam Ini (Part 2) — f&b1621

- **Tanggal & Waktu:** 25 November 2026, 21:50 – 22:55 WIB
- **Pelaksana:** Tim f&b1621 & AI Assistant
- **Status Akhir:** **100% SUKSES GO-LIVE (PRODUKSI)**
- **URL Aplikasi Utama (POS):** [`https://1621fnb.com`](https://1621fnb.com)
- **URL Endpoint Healthcheck:** [`https://1621fnb.com/api/health`](https://1621fnb.com/api/health)
- **URL Dashboard Coolify:** [`https://coolify.1621fnb.com`](https://coolify.1621fnb.com)
- **Server Produksi:** VPS Hostinger KVM 2 (`213.190.4.98` / `srv2193752.hstgr.cloud` — Ubuntu 24.04 LTS)

---

## DAFTAR ISI
1. [Ringkasan Perjalanan & Permasalahan yang Diselesaikan](#1-ringkasan-perjalanan--permasalahan-yang-diselesaikan)
2. [Langkah Demi Langkah yang Diinputkan (Kronologis & Tangkapan Layar)](#2-langkah-demi-langkah-yang-diinputkan-kronologis--tangkapan-layar)
3. [Nilai & Konfigurasi yang Telah Diinputkan (Cheatsheet)](#3-nilai--konfigurasi-yang-telah-diinputkan-cheatsheet)
4. [PENTING: Status Repo Saat Ini & Panduan Migrasi ke Private Repo (SSH Key)](#4-penting-status-repo-saat-ini--panduan-migrasi-ke-private-repo-ssh-key)
5. [Catatan Khusus Supabase Gratis (Free Tier) & Antisipasi Kedepan](#5-catatan-khusus-supabase-gratis-free-tier--antisipasi-kedepan)
6. [SOP Pembaruan Kode & Database di Masa Depan](#6-sop-pembaruan-kode--database-di-masa-depan)
7. [Checklist Go-Live Toko (Fase 5)](#7-checklist-go-live-toko-fase-5)

---

## 1. Ringkasan Perjalanan & Permasalahan yang Diselesaikan

Pada awal sesi (21:50 WIB), server VPS dan panel Coolify sudah siap dari sesi sebelumnya (Fase 1 & Fase 2 di `DEPLOY_CHANGELOG.md`). Sesi malam ini fokus menyelesaikan **Fase 3 (Supabase)** dan **Fase 4 (Coolify Deploy)** dengan memecahkan beberapa kendala teknis:

1. **Kepastian Supabase:** Proyek Supabase ternyata sudah dibuat sebelumnya (`xhfsogyqzcjfpwepiezc`). Setelah diuji via API langsung, terbukti 7 migrasi skema database, data cabang, akun staf/owner, produk, dan inventori sudah lengkap dan siap pakai.
2. **Perbedaan Domain:** Meluruskan keraguan antara `1621fnb.com` (aplikasi web POS publik) dan `coolify.1621fnb.com` (panel manajemen server).
3. **Kendala Hak Akses GitHub App:** User login sebagai *collaborator* (bukan owner `chairullinad`), sehingga tidak memiliki izin menginstall GitHub App atau membuka menu *Settings* repo. Masalah diatasi dengan memanfaatkan status repo yang **PUBLIC**, sehingga Coolify bisa langsung clone dan build tanpa butuh hak akses khusus.
4. **Keamanan Kredensial `.env`:** Memastikan bahwa `.env.local` tidak pernah bocor ke repository publik. Git history terbukti bersih dan hanya memuat `.env.example`.
5. **Kesiapan Build Next.js:** Menandai variabel `NEXT_PUBLIC_*` sebagai **Buildtime Variable** di Coolify agar Next.js Dockerfile tidak gagal kompilasi saat `npm run build`.

---

## 2. Langkah Demi Langkah yang Diinputkan (Kronologis & Tangkapan Layar)

Berikut urutan tindakan dan input yang dilakukan sepanjang sesi malam ini:

### Tahap 1: Konfigurasi Autentikasi di Supabase Dashboard
- **Lokasi:** [Supabase Dashboard](https://supabase.com/dashboard) $\rightarrow$ Project `xhfsogyqzcjfpwepiezc` $\rightarrow$ **Authentication** $\rightarrow$ **URL Configuration**.
- **Input yang dimasukkan:**
  - **Site URL:** `https://1621fnb.com`
  - **Redirect URLs (Whitelist):**
    - `https://1621fnb.com/**`
    - `http://localhost:3000/**`
    - `http://127.0.0.1:3000/**`
- **Tujuan:** Agar tautan reset password/email tidak nyasar ke localhost, namun tetap mengizinkan pengujian lokal di laptop.

---

### Tahap 2: Menghubungkan Repository GitHub ke Coolify
- **Tangkapan Layar Referensi:** *Screenshot 1 — GitHub App Registration Page*
  - Pada layar sempat muncul pilihan *Automated installation (Recommended)* dengan tombol *Register With GitHub* yang meminta passkey.
  - Karena akun berstatus collaborator dan tidak memiliki hak owner untuk repo `chairullinad/F-B1621`, langkah ini dibatalkan.
- **Tindakan yang Diambil:**
  - Masuk ke **Coolify $\rightarrow$ Projects $\rightarrow$ Default/fnb1621 $\rightarrow$ + New Resource**.
  - Memilih **Public Repository** (karena repo `https://github.com/chairullinad/F-B1621` berstatus publik).
  - Memasukkan URL: `https://github.com/chairullinad/F-B1621`
  - Branch: `main`
  - Build Pack: `Dockerfile`

---

### Tahap 3: Import & Pengisian Environment Variables
- **Tangkapan Layar Referensi:** *Screenshot 2 — Modal "Import environment variables"*
- **Input yang dimasukkan ke 4 kolom:**
  1. `NEXT_PUBLIC_SUPABASE_URL` = `https://xhfsogyqzcjfpwepiezc.supabase.co`
  2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` = `sb_publishable_sz-KjkC2o1Kzh39-609iAg_NvYKC_TB`
  3. `SUPABASE_SERVICE_ROLE_KEY` = `sb_secret_OG42vaWZ9aqQ3ozpp1TvDw_***` *(tersimpan aman di Coolify & .env.local)*
  4. `NEXT_PUBLIC_APP_TIMEZONE` = `Asia/Jakarta`
- **Aksi:** Menekan tombol ungu **"Update 4 Variables"**.

---

### Tahap 4: Pengaturan Domain & Verifikasi DNS
- **Tangkapan Layar Referensi:** *Screenshot 3 (App Details & Public Access) & Screenshot 4 (Domains Table)*
  - Pada layar detail aplikasi, bagian *Public access* awalnya terisi domain fallback: `http://qa9g1pum0fb6mxuni5afqp39.213.190.4.98.sslip.io`.
  - Tombol **`Manage Domains ->`** diklik.
- **Input yang dimasukkan:**
  - `https://1621fnb.com`
  - `https://www.1621fnb.com`
- **Hasil:** DNS status menampilkan **`• DNS matches` (Warna Hijau)** pada kedua domain, dengan opsi *Redirect HTTP to HTTPS* bernilai **Enabled**.

---

### Tahap 5: Pengaturan Buildtime & Runtime Variables
- **Tangkapan Layar Referensi:** *Screenshot 5 — Tabel Environment Variables*
- **Aksi:**
  - Memastikan kolom **Buildtime** dan **Runtime** keduanya tercentang (`✓`) untuk:
    - `NEXT_PUBLIC_SUPABASE_URL`
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
    - `NEXT_PUBLIC_APP_TIMEZONE`
- **Tujuan:** Next.js mewajibkan variabel dengan awalan `NEXT_PUBLIC_` tersedia pada waktu *buildtime* Docker (`ARG`) agar tersuntik ke dalam JavaScript bundle klien.

---

### Tahap 6: Eksekusi Deploy & Monitoring Build Log
- **Tangkapan Layar Referensi:** *Screenshot 6 — Deployment History & In Progress Log*
  - Menekan tombol **Deploy** di pojok kanan atas.
  - Log mencatat:
    - Docker version `29.10.0` with BuildKit & Buildx.
    - Menarik kode commit terbaru: `Importing Chairullinad/F-B1621:main (commit sha 9609919c5d247366d485c8cd4bcef472e728f8fb)`.
    - Pesan commit: `9609919 refactor(ui,server): standardize kios te...`.
    - Memulai Docker multi-stage build (`deps` $\rightarrow$ `builder` $\rightarrow$ `runner`).
    - *Graceful shutdown* dari container helper builder setelah selesai membuat image.
- **Hasil Akhir:** Status container berubah menjadi **Running / Healthy** pada port `3000`.

---

### Tahap 7: Uji Coba Healthcheck Publik
- **Aksi:** Mengakses URL `https://1621fnb.com/api/health` dari browser.
- **Hasil Validasi JSON:**
  ```json
  {
    "ok": true,
    "service": "pos-1621-fnb",
    "status": "healthy",
    "serverTimeWib": "25 Nov 2026, 22.40 WIB",
    "timestamp": "2026-11-25T15:40:30.678Z"
  }
  ```
  *(Status sehat, nama service benar, dan jam WIB sinkron).*

---

## 3. Nilai & Konfigurasi yang Telah Diinputkan (Cheatsheet)

Simpan rangkuman nilai ini jika sewaktu-waktu Anda butuh mereferensikan kembali:

| Variabel / Pengaturan | Nilai Konfigurasi | Keterangan |
| :--- | :--- | :--- |
| **Domain Utama POS** | `https://1621fnb.com` | Aplikasi kasir, staf, dapur, dan scan QR meja |
| **Domain Alternatif** | `https://www.1621fnb.com` | Redirect otomatis ke domain utama |
| **Domain Panel Coolify** | `https://coolify.1621fnb.com` | Akses panel admin VPS & deploy container |
| **IP Publik VPS Hostinger** | `213.190.4.98` | Server Hostinger KVM 2 Ubuntu 24.04 LTS |
| **NEXT_PUBLIC_SUPABASE_URL** | `https://xhfsogyqzcjfpwepiezc.supabase.co` | Endpoint REST / Auth / Realtime Supabase |
| **NEXT_PUBLIC_SUPABASE_ANON_KEY** | `sb_publishable_sz-KjkC2o1Kzh39-609iAg_NvYKC_TB` | Public Publishable API Key |
| **SUPABASE_SERVICE_ROLE_KEY** | `sb_secret_OG42vaWZ9aqQ3ozpp1TvDw_***` | Secret Admin Key (Hanya di server Coolify & .env.local) |
| **NEXT_PUBLIC_APP_TIMEZONE** | `Asia/Jakarta` | Waktu operasional WIB |
| **Internal Port Container** | `3000` | Port default Next.js standalone |
| **Build Pack Strategy** | `Dockerfile` | Multi-stage Node.js 22 Alpine |

---

## 4. PENTING: Status Repo Saat Ini & Panduan Migrasi ke Private Repo (SSH Key)

> [!WARNING]
> **CATATAN PENTING UNTUK MASA DEPAN:**  
> Saat ini Coolify menarik kode menggunakan mode **Public Repository** karena repository `chairullinad/F-B1621` masih berstatus publik di GitHub.  
> Jika suatu saat repository tersebut diubah menjadi **PRIVATE**, proses deploy di Coolify akan gagal (error 403 / repository not found) kecuali Anda menyambungkannya dengan **SSH Key**.

### Panduan Lengkap Jika Repo Diubah Menjadi Private (Khusus Collaborator):

Karena Anda berstatus **Collaborator** dan tidak bisa mengakses menu *Settings* pada repository milik `chairullinad`, ikuti panduan berikut agar Coolify tetap bisa menarik repo private tanpa butuh akun owner:

#### Langkah 1: Ambil Public Key dari Coolify
1. Buka dashboard Coolify $\rightarrow$ menu **Keys & Tokens** (atau di resource aplikasi).
2. Di bagian **Private Keys / Deploy Keys**, Coolify menyediakan kunci SSH. Salin teks **Public Key** yang diawali dengan `ssh-ed25519 ...` atau `ssh-rsa ...`.

#### Langkah 2: Pasang SSH Key di Profil Akun GitHub Anda Sendiri
1. Login ke akun GitHub Anda.
2. Di pojok kanan atas, klik foto profil Anda $\rightarrow$ pilih **Settings**.
3. Di bilah menu kiri, pilih **SSH and GPG keys**.
4. Klik tombol hijau **New SSH key**.
5. Beri judul (Title): `Coolify VPS 1621FNB`.
6. Tempel (*paste*) Public Key dari Coolify ke dalam kotak **Key**.
7. Klik **Add SSH key**.

#### Mengapa Cara Ini Berhasil?
Karena akun GitHub Anda sudah resmi terdaftar sebagai *Collaborator (Write access)* pada repository `chairullinad/F-B1621`. Ketika Coolify melakukan clone menggunakan SSH Key milik akun Anda, GitHub otomatis mengizinkan Coolify menarik kode repo private tersebut.

#### Langkah 3: Ubah Sumber di Coolify
1. Di Coolify, ubah URL repository dari format HTTPS menjadi format Git SSH:
   ```text
   git@github.com:chairullinad/F-B1621.git
   ```
2. Pilih SSH Key yang baru Anda daftarkan tadi.
3. Klik **Save** dan **Deploy**.

---

## 5. Catatan Khusus Supabase Gratis (Free Tier) & Antisipasi Kedepan

Berikut batasan paket gratis Supabase dan statusnya terhadap toko Anda:

1. **Auto-Pause (Tidur Otomatis setelah 7 Hari Tanpa Aktivitas):**
   - **Kondisi Toko:** Aman selama operasional berjalan setiap hari, karena setiap kali kasir login atau order dibuat, Supabase menganggap project aktif.
   - **Antisipasi:** Jika toko tutup/libur panjang lebih dari 7 hari, login ke [Supabase Dashboard](https://supabase.com/dashboard) lalu klik **Restore / Resume** sebelum toko dibuka kembali.
2. **Kapasitas Database (Limit 500 MB):**
   - **Kondisi Toko:** Saat ini pemakaian masih sangat kecil (< 10 MB). 500 MB sanggup menampung puluhan ribu riwayat order.
3. **Koneksi Realtime Bersamaan (Limit 200 Client):**
   - **Kondisi Toko:** Operasional standar (2 kasir + 2 dapur + 3 waiter + 30 pelanggan) hanya butuh ~37 koneksi, jauh di bawah batas 200.
4. **Kapan Waktunya Upgrade ke Supabase Pro (\$25/bulan)?**
   - Saat omzet toko sudah stabil dan Anda menginginkan:
     - Jaminan database **tidak pernah auto-pause**.
     - Fitur **Daily Automated Backups** harian otomatis.
     - Fitur **Point-in-Time Recovery (PITR)** untuk proteksi rollback data jika terjadi salah input fatal di kasir.

---

## 6. SOP Pembaruan Kode & Database di Masa Depan

### A. Jika Ada Update Kodingan (Fitur Baru / Bug Fix di Next.js)
1. Tim melakukan commit dan `git push origin main`.
2. Buka `https://coolify.1621fnb.com`.
3. Buka resource aplikasi `fnb1621`.
4. Klik tombol **Deploy** di pojok kanan atas.
5. Selesai (zero downtime).

*(Opsional: Minta pemilik repo memasang Deploy Webhook dari Coolify ke Settings GitHub agar otomatis ter-deploy setiap push).*

### B. Jika Ada Perubahan Data di Database Supabase
- Mengubah harga, menambah menu, menambah bahan baku, update stok, atau mengubah akun staf:
- **100% OTOMATIS & REALTIME.** Detik itu juga langsung berubah di aplikasi kasir & HP pelanggan **tanpa perlu menyentuh atau me-redeploy Coolify**.

---

## 7. Checklist Go-Live Toko (Fase 5)

Silakan gunakan checklist berikut untuk persiapan pembukaan toko:

- [ ] **Login Owner:** Buka `https://1621fnb.com/login` dan pastikan dashboard admin dapat diakses.
- [ ] **Pengaturan Toko (`/dashboard/pengaturan`):**
  - [ ] Periksa Nama Restoran, Alamat, dan Nomor Kontak.
  - [ ] Unggah/tempel string QRIS resmi toko agar pelanggan bisa membayar langsung di meja.
  - [ ] Tentukan catatan kaki struk kasir (*receipt footer*).
- [ ] **Cetak QR Meja (`/dashboard/meja/cetak`):** Cetak QR code 100 meja fisik dan tempel di meja pelanggan.
- [ ] **Simulasi Transaksi Meja:** Scan QR meja dari smartphone $\rightarrow$ pesan 1 menu $\rightarrow$ pastikan pesanan muncul di `https://1621fnb.com/kasir` dalam < 2 detik tanpa refresh.
- [ ] **Instalasi PWA:** Buka `https://1621fnb.com` di tablet/HP kasir dan dapur, lalu pilih **"Add to Home Screen"** untuk pengalaman layar penuh tanpa browser bar.
