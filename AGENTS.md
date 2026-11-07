# AGENTS.md

Aturan kerja untuk agent di proyek **f&b1621 (POS, Inventory, & Akuntansi F&B Web)**. Baca `PRD.md` sebelum mengerjakan tugas apa pun. Jika PRD dan file ini berbeda, PRD yang menang; beri tahu saya perbedaannya.

## Ringkasan produk

POS, Inventory, dan Akuntansi F&B berbasis web (PWA) dengan brand **f&b1621** untuk restoran/kafe dengan 100 meja dan 5 perangkat kasir. Alur utama:

1. Pelanggan scan QR di meja (`/m/[token]`), memesan, dan memilih metode pembayaran: **QRIS di meja** (utama) atau **Tunai di kasir** (opsi kedua). Order berstatus `PENDING`.
2. Untuk **QRIS di meja**: layar pelanggan menampilkan QRIS toko dengan nominal murni sesuai tagihan dan label meja (`MEJA-<no>`). Setelah membayar, pelanggan menekan tombol **Saya Sudah Bayar** (tanpa upload bukti bayar). Layar Kasir menerima notifikasi real-time berisi **Nomor Meja + Nominal**; kasir mencocokkan uang masuk lalu menekan **Pembayaran Sesuai**. Untuk **Tunai**: pelanggan membayar di kasir dalam 15 menit. Jika tidak dibayar/diverifikasi dalam 15 menit, order menjadi `EXPIRED`.
3. Saat kasir menekan **Pembayaran Sesuai** (QRIS) atau **Bayar** (Tunai), order menjadi `PAID`, stok bahan baku terpotong otomatis sesuai resep (BOM), jurnal akuntansi otomatis tercatat, masuk ke **Layar Dapur (KDS 3-Tahap: Baru → Mulai Masak → Siap Saji)**, dan **Layar Pelanggan** memperbarui status pesanan secara real-time.
4. Dapur menandai `READY`, pelayan mengantar dan menandai `SERVED`. Begitu order berstatus `SERVED` (atau `EXPIRED`/`CANCELLED`), sesi pemantauan order pada layar pelanggan otomatis berakhir (*expired*) dan tidak bisa diakses kembali.
5. Dilengkapi Modul **Inventory & Gudang** (Bahan Baku, Resep/BOM, Stock Opname Blind Count + Approval, Waste Tracking, Supplier & PO, Transfer Stok) serta **Laporan Keuangan & Akuntansi 5 Tab** (Jurnal Umum, Laba Rugi, Neraca, Arus Kas, Rekap Pajak).

Role: `owner`, `cashier`, `warehouse`, `kitchen`, `waiter`. Pelanggan tidak punya akun.

## Stack

- Next.js (App Router) + TypeScript (strict) + Tailwind CSS + shadcn/ui
- Supabase: Postgres, Auth, Realtime, Row Level Security
- TanStack Query untuk data server, Zod untuk validasi
- Deploy: VPS Hostinger KVM 2 dengan Coolify (bukan Vercel)
- Dua project Supabase: `dev` dan `produksi`. Jangan pernah memakai kunci produksi saat development.

## Struktur folder

```
src/app/(staff)/kasir, order-manual, dapur, antar, dashboard/...
src/app/m/[token]            # halaman pelanggan, tanpa login
src/app/struk/[orderId]
src/components/              # komponen UI
src/lib/                     # supabase client, util, format
src/lib/money.ts             # SATU-SATUNYA tempat hitung total, pajak, pembulatan
src/server/                  # server actions dan logika bisnis
supabase/migrations/         # semua perubahan skema, berurutan
supabase/seed.sql
```

## Konvensi

- UI **Bahasa Indonesia**. Kode, nama variabel, dan nama tabel bahasa Inggris.
- Uang disimpan sebagai **integer Rupiah**, tidak pernah float. Tampilan: `Rp 25.000`. Format lewat satu helper.
- Zona waktu `Asia/Jakarta`. Simpan timestamp UTC (`timestamptz`), tampilkan WIB.
- Desain mobile-first dan sentuh-friendly: area tap minimal 44px. Uji di lebar iPhone (390px) dan tablet.
- Komponen kecil, satu tanggung jawab. Tidak ada `any` di TypeScript.
- Semua input divalidasi dengan Zod di server, bukan hanya di klien.

## Aturan bisnis yang tidak boleh dilanggar

- Total dihitung **di server/database**, tidak dipercaya dari klien.
- Harga dan nama produk disalin ke `order_items` saat order dibuat (snapshot).
- Pajak dan service charge **mati secara default**, persentase kosong. Saklar tidak bisa dinyalakan sebelum persentase diisi. Status, persentase, dan mode harga disalin ke order saat dibuat.
- Order hanya masuk dapur setelah `PAID`.
- Order `PAID` tidak bisa diedit. Koreksi hanya lewat pembatalan dengan alasan wajib dan membuat catatan `refunds`.
- Hanya kasir yang boleh merevisi order, dan hanya saat `PENDING`. Pelayan dan pelanggan tidak bisa mengedit.
- Order `SERVED` hanya bisa dibatalkan Owner, hanya untuk kesalahan outlet. Kesalahan pelanggan tidak boleh di-refund.
- Satu pembayaran sah per order. Gunakan pengecekan `version` atau penguncian baris agar 5 kasir tidak bisa membayar order yang sama bersamaan.
- Nomor meja ditentukan server dari `qr_token`, tidak pernah dari input pelanggan.
- Kedaluwarsa 15 menit dijalankan job di server, bukan di browser.

## Audit trail (wajib)

- Tabel `audit_logs` **append-only**: hanya INSERT. Blokir UPDATE dan DELETE lewat RLS dan trigger, termasuk untuk Owner.
- Pencatatan dilakukan oleh **trigger database**, bukan hanya kode aplikasi.
- Catat: waktu server, user dan role, perangkat/IP, aksi, objek, nilai sebelum dan sesudah, alasan.
- Setiap catatan menyimpan `prev_hash` dan `hash` agar perubahan manual terdeteksi.
- Data bisnis memakai soft delete (`deleted_at`). Jangan hard delete order, produk, meja, atau user.

## Keamanan

- RLS aktif di semua tabel. Tidak ada tabel tanpa policy.
- Halaman pelanggan tidak boleh mengakses tabel langsung. Pakai endpoint/RPC server khusus yang hanya mengembalikan data meja miliknya.
- Rate limit pengiriman order per meja dan batasi item per kiriman.
- `service_role` key hanya di server, tidak pernah di kode klien atau repository.
- Rahasia hanya lewat environment variable. Jangan commit `.env`.

## Cara kerja agent

1. **Mulai dengan plan.** Untuk setiap tugas, tulis implementation plan dulu dan tunggu persetujuan saya sebelum menulis kode.
2. **Satu fitur per tugas.** Jangan menambah fitur di luar tugas. Hal di luar scope dicatat sebagai saran, bukan dikerjakan.
3. **Migration, bukan edit manual.** Semua perubahan skema lewat file di `supabase/migrations/`. Jangan ubah skema lewat dashboard.
4. Jalankan lint, typecheck, dan test sebelum menyatakan selesai.
5. Uji alur di browser sebelum selesai, dan laporkan apa yang diuji.
6. Satu fitur selesai = satu commit dengan pesan jelas (contoh: `feat(kasir): pembayaran tunai`).
7. Jika ada yang ambigu dan tidak dijawab PRD, tanyakan, jangan menebak untuk aturan uang atau audit.

## Di luar scope fase 1 (jangan dibangun)

Integrasi payment gateway pihak ketiga (Midtrans/Xendit), kartu EDC, akun pelanggan, printer thermal/dapur otomatis, stok, shift kas, modifier, multi-outlet, mode offline.
