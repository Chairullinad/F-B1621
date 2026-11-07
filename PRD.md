# PRD: POS F&B Web (MVP Order sampai Kasir)

Versi 0.2 | Dokumen acuan untuk pengembangan dengan Antigravity

## 1. Ringkasan

Aplikasi POS berbasis web (PWA) untuk restoran/kafe, terinspirasi ESB POSLite. Bisa dipakai di iPhone, Android, tablet, dan laptop lewat browser. Fase 1 fokus pada satu alur: **pelanggan scan QR di meja dan memesan, membayar langsung dengan QRIS di meja (atau tunai di kasir), kasir memverifikasi pembayaran sesuai nomor meja & nominal, dapur memasak, lalu pelayan mengantar**. Pelanggan memantau status pesanannya secara real-time di HP sampai disajikan, lalu sesi otomatis kedaluwarsa. Pajak dan service charge tersedia sebagai pengaturan yang bisa dinyalakan atau dimatikan (default mati). Setiap tindakan penting tercatat di audit trail.

## 2. Tujuan dan Non-Tujuan

**Tujuan fase 1**

- Pelanggan dapat memesan sendiri lewat QR di meja, tanpa login dan tanpa install aplikasi, serta memilih bayar via **QRIS di meja** atau **Tunai di kasir**.
- Saat memilih QRIS di meja, QRIS toko tampil otomatis dengan nominal murni sesuai tagihan dan label meja (`MEJA-<no>`). Pelanggan menekan **Saya Sudah Bayar** (tanpa upload screenshot).
- Order dan konfirmasi pembayaran QRIS muncul real-time di layar kasir lengkap dengan **Nomor Meja + Nominal**; setelah kasir mencocokkan mutasi dan menekan **Pembayaran Sesuai** (atau menerima tunai), order menjadi `PAID`, otomatis masuk ke layar dapur, dan layar pelanggan ter-update real-time.
- Dapur menandai pesanan siap (`READY`), pelayan mengantar ke meja (`SERVED`), dan setelah `SERVED` sesi pemantauan pesanan pelanggan otomatis berakhir (*expired*).
- Kasir dapat merevisi atau membatalkan order dengan alasan wajib; pembatalan setelah bayar tercatat sebagai refund agar alur keuangan jelas.
- Setiap tindakan penting tercatat di audit trail yang tidak bisa diubah, sebagai bukti bagi pemilik usaha.
- Owner dapat mengelola menu, meja (QR), QRIS toko, pajak, dan melihat transaksi serta jejak audit.

**Bukan tujuan fase 1 (ditunda)**

- Akun/login pelanggan, poin loyalty, dan promo
- Integrasi payment gateway pihak ketiga (Midtrans/Xendit) dan kartu EDC
- Printer dapur otomatis dan printer thermal Bluetooth/USB (fase 1 cukup layar dapur dan cetak lewat browser)
- Manajemen stok, shift kas, modifier kompleks, multi-outlet
- Mode offline penuh

## 3. Pengguna dan Role

| Role | Tugas utama | Akses |
| --- | --- | --- |
| Owner | Kelola menu, meja/QR, user; lihat transaksi dan refund | Dashboard + semua layar |
| Kasir | Terima order pelanggan, terima pembayaran, revisi dan batalkan order | Layar Kasir + Layar Order Manual |
| Dapur | Melihat order yang sudah dibayar, menandai siap diantar | Layar Dapur |
| Pelayan | Mengantar pesanan ke meja; tidak bisa membuat atau mengedit order | Layar Antar |

Asumsi: 1 outlet dulu, tetapi tabel dirancang sudah membawa `outlet_id` agar mudah dikembangkan ke multi-outlet.

**Pelanggan** tidak punya akun. Mereka hanya mengakses halaman menu lewat QR di meja dan hanya bisa membuat order untuk meja pada QR tersebut.

## 4. Alur Utama (Happy Path)

1. Pelanggan memindai QR di meja; menu terbuka di browser HP tanpa login. Nomor meja terisi otomatis dan tidak bisa diubah.
2. Pelanggan memilih menu, jumlah, catatan, dan metode pembayaran (**QRIS di Meja** atau **Bayar Tunai di Kasir**). Harga adalah harga akhir, tanpa pajak (kecuali pajak diaktifkan Owner).
3. Pelanggan menekan **Kirim Pesanan**. Order berstatus `PENDING` dengan batas waktu 15 menit:
   - Jika memilih **QRIS di Meja**: layar pelanggan langsung menampilkan QRIS toko dengan nominal murni sesuai tagihan dan label referensi nomor meja (`MEJA-<no>`). Setelah membayar di m-banking/e-wallet, pelanggan menekan tombol **Saya Sudah Bayar** (tanpa perlu upload bukti bayar).
   - Jika memilih **Bayar Tunai di Kasir**: layar pelanggan menampilkan instruksi bayar di kasir dalam 15 menit.
4. Order muncul real-time di Layar Kasir dengan **nomor meja, nominal tagihan, metode bayar, status konfirmasi QRIS pelanggan, dan sisa waktu**.
5. Untuk QRIS, kasir mencocokkan uang yang masuk di mutasi QRIS toko dengan **Nomor Meja & Nominal** yang tampil di Layar Kasir. Untuk Tunai, pelanggan membayar di kasir. Jika ada item yang salah sebelum dibayar, kasir dapat merevisi order.
6. Kasir menekan **Pembayaran Sesuai** (untuk QRIS) atau **Bayar** (untuk Tunai). Order menjadi `PAID`, struk tampil, order otomatis masuk ke **Layar Dapur**, dan **Layar Pelanggan** berubah status menjadi *Pembayaran Terverifikasi — Sedang Disiapkan Dapur*.
7. Dapur memasak lalu menekan **Siap Diantar** (`READY`). Pelayan melihatnya di Layar Antar, dan Layar Pelanggan berubah menjadi *Pesanan Siap — Sedang Diantar ke Meja Anda*.
8. Pelayan mengantar ke meja dan menekan **Sudah Diantar** (`SERVED`). Layar pelanggan menampilkan bahwa pesanan telah disajikan, lalu **sesi halaman pemantauan pesanan tersebut otomatis kedaluwarsa (*expired*) dan tidak bisa diakses lagi**.

### Alur order manual oleh kasir (cadangan)

1. Kasir membuka Layar Order Manual untuk pelanggan yang tidak memakai QR (takeaway atau tanpa HP).
2. Kasir memilih tipe order (dine-in dengan nomor meja, atau takeaway), menu, jumlah, dan catatan.
3. Kasir menerima pembayaran tunai; uang diterima dan kembalian dihitung otomatis.
4. Order langsung `PAID` dan masuk ke Layar Dapur.

Catatan: pelayan tidak dapat membuat atau mengedit order. Hanya kasir yang boleh merevisi order, dan hanya sebelum dibayar.

### Alur alternatif

- **Kedaluwarsa:** order `PENDING` yang tidak dibayar dalam 15 menit menjadi `EXPIRED` otomatis. Layar pelanggan menampilkan pengumuman dan tombol untuk memesan ulang.
- **Revisi sebelum bayar:** hanya kasir yang boleh mengubah item. Pelanggan tidak bisa mengedit order yang sudah terkirim.
- **Pelanggan salah pesan:** pelanggan membuat order baru; order lama kedaluwarsa atau dibatalkan kasir.
- **Batal setelah bayar:** oleh kasir atau Owner, alasan wajib, tercatat sebagai refund (lihat 5.10).

## 5. Kebutuhan Fungsional

### 5.1 Autentikasi dan Role

- Login email + password untuk staf (Owner, Kasir, Dapur, Pelayan). Pelanggan tidak login.
- Setelah login, user diarahkan sesuai role: Owner ke dashboard, Kasir ke layar kasir, Dapur ke layar dapur, Pelayan ke layar antar.
- Route dilindungi berdasarkan role, baik di UI maupun di database (Row Level Security).
- Owner dapat menambah, menonaktifkan, dan mengatur role user.

### 5.2 Master Data (Dashboard Owner)

- CRUD **kategori** (nama, urutan tampil).
- CRUD **produk**: nama, kategori, harga, foto (opsional), status aktif/habis.
- Toggle "Habis" cepat dari daftar produk; produk habis tidak bisa dipesan.
- CRUD **meja**: 100 meja per outlet. Nomor meja tetap dan tidak bisa dipindah; setiap meja punya QR unik. QR dapat dicetak massal (satu PDF berisi semua meja) atau per meja.
- Pengaturan outlet: nama, alamat, teks footer struk, dan lama kedaluwarsa order (default 15 menit).
- **Pengaturan pajak dan service charge:** disiapkan sekarang, diisi manual oleh Owner nanti. Saklar aktif/nonaktif untuk masing-masing (default nonaktif), persentase (kosong sampai Owner mengisinya), dan mode harga (belum termasuk atau sudah termasuk pajak). Saklar tidak bisa dinyalakan sebelum persentase diisi. Perubahan hanya berlaku untuk order baru dan tercatat di audit trail.
- **Pengaturan notifikasi email:** alamat email Owner, saklar laporan bulanan, dan pilihan kejadian sensitif yang dikirim langsung (lihat 5.11).

### 5.3 Layar Order Manual (Kasir)

- Grid produk dengan tab kategori dan pencarian nama.
- Keranjang: ubah jumlah, hapus item, catatan per item.
- Pilih tipe order (Dine-in/Takeaway) dan nomor meja.
- Ringkasan: subtotal, diskon (bila ada), service charge dan pajak (bila aktif), dan total.
- Tombol **Bayar** langsung; order yang dibuat di sini otomatis `PAID`.
- Hanya Kasir dan Owner yang bisa membuka layar ini.

### 5.4 Layar Kasir

- Daftar **Order Masuk** (`PENDING`) real-time di semua perangkat kasir (5 perangkat), urut dari yang terlama: nomor order, meja, jumlah item, total, dan sisa waktu sebelum kedaluwarsa.
- Bunyi/indikator visual saat ada order baru.
- Order yang sedang dibuka kasir lain diberi tanda nama kasirnya; order yang sudah dibayar di perangkat lain langsung hilang dari daftar, dan pembayaran ganda ditolak server.
- Detail order: daftar item, catatan, dan total.
- **Revisi order** (tambah, kurangi, ubah catatan, hapus item) hanya oleh Kasir dan hanya sebelum dibayar; setiap revisi merekam kondisi sebelum dan sesudah.
- **Diskon** (nominal atau persen) pada level order oleh Kasir/Owner, dengan alasan wajib. Owner dapat menetapkan batas diskon maksimum untuk kasir.
- **Pembayaran tunai:** input uang diterima, tombol nominal cepat (pas, 50.000, 100.000), kembalian otomatis.
- Setelah bayar: status `PAID`, struk tampil, dan order otomatis masuk ke Layar Dapur.
- **Batalkan order** (alasan wajib) sesuai aturan 5.10.

### 5.5 Struk

- Halaman struk dengan layout lebar 58mm/80mm yang rapi saat dicetak lewat `window.print()`.
- Isi: nama outlet, nomor order, tanggal-jam, kasir, meja/tipe order, daftar item, diskon (bila ada), service charge dan pajak (bila aktif), total, tunai, kembalian, footer.
- Tombol cetak ulang dari riwayat transaksi; setiap cetak ulang dicatat di audit trail.

### 5.6 Riwayat Transaksi (Dashboard)

- Tabel order dengan filter tanggal, status, dan kasir.
- Detail order dan cetak ulang struk.
- Ringkasan sederhana hari ini: jumlah transaksi dan total penjualan.

### 5.7 Self-Order Pelanggan via QR Meja

- QR unik per meja berisi alamat `/m/<token>`; token acak dan panjang, bukan nomor meja, supaya tidak bisa ditebak.
- Meja bersifat tetap: nomor meja ditentukan server dari token. Pelanggan tidak bisa memilih atau mengubahnya.
- Owner mencetak QR per meja dari Dashboard dan bisa mengganti token jika QR bocor atau rusak; QR lama otomatis tidak berlaku.
- Halaman pelanggan: menu per kategori, pencarian, keranjang, catatan, dan tombol Kirim Pesanan.
- Menu yang habis tampil abu-abu dan tidak bisa dipesan.
- **Pengumuman di layar pesanan pelanggan:** setelah kirim, tampil instruksi bayar di kasir dan hitung mundur 15 menit, lalu status berjalan: Menunggu pembayaran, Sedang disiapkan, Siap diantar, Sudah diantar. Jika order kedaluwarsa atau dibatalkan, tampil pengumuman dengan alasan dan tombol pesan ulang.
- Pelanggan tidak bisa mengedit order yang sudah terkirim; perubahan lewat kasir atau dengan order baru.
- Anti-penyalahgunaan: order tidak masuk dapur sebelum dibayar, ada batas kirim per meja dan maksimal item per kiriman, hanya meja aktif yang bisa memesan, dan pelanggan hanya bisa melihat order mejanya lewat endpoint server khusus.

### 5.8 Layar Dapur

- Menampilkan order `PAID` secara real-time, urut waktu bayar: nomor order, meja, item, jumlah, dan catatan.
- Bunyi/indikator saat ada order baru.
- Tombol **Siap Diantar** per order mengubah status menjadi `READY`.
- Order yang dibatalkan kasir tampil sesaat dengan tanda "Dibatalkan" agar dapur berhenti memasak.
- Dapur tidak melihat harga atau data pembayaran.

### 5.9 Layar Antar (Pelayan)

- Menampilkan order `READY` per meja: nomor meja, item, dan catatan.
- Tombol **Sudah Diantar** mengubah status menjadi `SERVED`.
- Pelayan tidak bisa membuat, mengedit, atau membatalkan order.

### 5.10 Pembatalan dan Refund

- Kasir atau Owner dapat membatalkan order `PENDING`, `PAID`, atau `READY`. Alasan wajib diisi.
- Order `SERVED` hanya bisa dibatalkan oleh **Owner**, dan hanya jika kesalahan ada di pihak outlet (misalnya salah menu atau makanan bermasalah). Jika kesalahan dari pelanggan (salah pilih, berubah pikiran), tidak boleh dibatalkan atau di-refund.
- Pembatalan order yang sudah dibayar membuat catatan **refund** tunai: nominal, kategori alasan (kesalahan outlet / lainnya), catatan wajib, pelaku, dan waktu.
- Pembatalan dan refund tampil di riwayat transaksi dan ringkasan harian: penjualan kotor, refund, dan penjualan bersih.

### 5.11 Audit Trail (Jejak Audit)

- Semua tindakan penting dicatat otomatis oleh **database** (trigger), bukan hanya oleh aplikasi, sehingga tidak bisa dilewati lewat browser.
- Yang dicatat: login/logout dan gagal login, pembuatan order, setiap perubahan status, revisi item (nilai sebelum dan sesudah), diskon, pembayaran, pembatalan, refund, cetak ulang struk, perubahan menu dan harga, perubahan pengaturan (pajak, kedaluwarsa, notifikasi), penggantian QR meja, serta perubahan user dan role.
- Setiap catatan berisi: waktu server, siapa (user dan role), perangkat/IP, aksi, objek, nilai sebelum dan sesudah, dan alasan bila ada. Order dari pelanggan tanpa login dicatat dengan token meja, IP, dan perangkat.
- **Hanya bisa ditambah (append-only):** tidak ada edit atau hapus pada `audit_logs`, bahkan oleh Owner, dijaga dengan Row Level Security dan trigger database. Tiap catatan menyimpan hash catatan sebelumnya agar perubahan manual terdeteksi.
- Data bisnis tidak dihapus permanen: order, produk, meja, dan user memakai soft delete.
- Owner memiliki halaman **Jejak Audit**: filter tanggal, user, aksi, dan nomor order; riwayat lengkap per order (siapa membuat, merevisi, membayar, membatalkan); ekspor CSV.
- **Email ke Owner:** semuanya berupa pengaturan yang diatur Owner: (1) laporan bulanan otomatis berisi penjualan kotor, refund, pembatalan, diskon, dan perubahan pengaturan selama sebulan; (2) notifikasi langsung untuk kejadian sensitif seperti refund, pembatalan order yang sudah dibayar, diskon, dan perubahan harga atau pengaturan. Owner menyalakan atau mematikan tiap pilihan dan menentukan kejadian mana yang dikirim. Email dikirim dari job di server lewat layanan email transaksional, dan setiap pengiriman dicatat di audit trail.

## 6. Status Order

| Status | Arti | Transisi berikutnya |
| --- | --- | --- |
| `PENDING` | Order dari pelanggan, menunggu pembayaran (maksimal 15 menit) | `PAID`, `EXPIRED`, `CANCELLED` |
| `PAID` | Sudah dibayar, masuk Layar Dapur | `READY`, `CANCELLED` |
| `READY` | Siap diantar | `SERVED`, `CANCELLED` |
| `SERVED` | Sudah diantar ke meja | `CANCELLED` (hanya Owner, hanya kesalahan outlet) |
| `EXPIRED` | Tidak dibayar dalam 15 menit | Final |
| `CANCELLED` | Dibatalkan dengan alasan wajib | Final |

Order manual dari kasir langsung `PAID`. Kedaluwarsa dijalankan otomatis oleh server (job terjadwal), bukan oleh browser pelanggan.

## 7. Aturan Bisnis

- Semua nominal disimpan sebagai **bilangan bulat Rupiah** (integer).
- Total = jumlah (harga x qty) dikurangi diskon; service charge dan pajak ditambahkan hanya bila diaktifkan (lihat di bawah).
- Diskon wajib alasan, hanya oleh Kasir/Owner, dan tercatat di audit trail.
- Harga dan nama produk **disalin ke `order_items`** saat order dibuat (snapshot), sehingga perubahan harga tidak mengubah transaksi lama.
- Nomor order berurutan per outlet per hari, contoh `20261107-0001`.
- Uang diterima tidak boleh kurang dari total.
- Hanya satu pembayaran sah per order; jika dua kasir menekan Bayar bersamaan, server menolak yang kedua.
- Order `PENDING` kedaluwarsa otomatis 15 menit setelah dibuat. Pelanggan tidak bisa mengubah order; hanya Kasir yang bisa merevisi, dan hanya sebelum `PAID`.
- Order `PAID` tidak bisa diedit; koreksi lewat pembatalan dengan alasan wajib yang menghasilkan refund tercatat.
- Order hanya masuk dapur setelah `PAID`.

**Pajak dan service charge** disiapkan di sistem tetapi dinyalakan dan diisi manual oleh Owner nanti (default mati, persentase kosong). Saat order dibuat, status aktif, persentase, dan mode harga disalin ke order, sehingga mengubah pengaturan tidak mengubah order lama. Mode *belum termasuk*: service = % x (subtotal - diskon); pajak = % x (subtotal - diskon + service); keduanya ditambahkan ke total. Mode *sudah termasuk*: total tidak berubah, pajak hanya ditampilkan di struk sebagai komponen harga. Pembulatan ke Rupiah memakai satu fungsi yang sama di seluruh aplikasi.

## 8. Model Data (Draft)

```
outlets        (id, name, address, receipt_footer, order_expiry_minutes,
                tax_enabled, tax_percent [nullable], service_enabled, service_percent [nullable],
                price_includes_tax, qris_enabled, qris_raw_payload [nullable], qris_merchant_name [nullable], created_at)
notification_settings (id, outlet_id, owner_email, monthly_report_enabled, instant_events [jsonb], updated_at)
profiles       (id -> auth.users, outlet_id, full_name, role[owner|cashier|kitchen|waiter], is_active, deleted_at)
categories     (id, outlet_id, name, sort_order, is_active, deleted_at)
products       (id, outlet_id, category_id, name, price, image_url, is_available, is_active, deleted_at)
tables         (id, outlet_id, table_no, name, qr_token, is_active, deleted_at)
orders         (id, outlet_id, order_no, source[customer_qr|cashier], order_type[dine_in|takeaway], table_id,
                payment_choice[qris|cash], status[pending|paid|ready|served|expired|cancelled],
                subtotal, discount, discount_reason, service_rate, service_amount, tax_rate, tax_amount,
                price_includes_tax, total, version, customer_claimed_paid_at, tracking_expired_at,
                expires_at, created_at, paid_at, ready_at, served_at,
                paid_by, served_by, cancelled_by, cancelled_at, cancel_reason, deleted_at)
order_items    (id, order_id, product_id, product_name, unit_price, qty, note, line_total)
payments       (id, order_id, method[cash|qris], amount_received, change_amount, created_by, created_at)
refunds        (id, order_id, payment_id, amount, reason_category[outlet_fault|other], reason, created_by, created_at)
audit_logs     (id, outlet_id, user_id, role, device, ip, action, entity, entity_id,
                before, after, reason, prev_hash, hash, created_at)   -- append-only
```

Catatan: tabel `payments` dibuat terpisah sejak awal supaya metode QRIS/kartu bisa ditambahkan tanpa mengubah struktur.

Catatan: `tables.qr_token` unik, acak, dan bisa diganti Owner. `orders.expires_at` dipakai job di server untuk mengubah order `pending` yang lewat batas menjadi `expired`. `orders.version` mencegah dua kasir saling menimpa revisi. Revisi kasir hanya mengubah `order_items` selama status `pending`, dengan nilai sebelum dan sesudah direkam di `audit_logs`, yang hanya boleh di-INSERT.

## 9. Kebutuhan Non-Fungsional

- **Platform:** web responsif, utama diuji di Safari iPhone/iPad dan Chrome Android/desktop.
- **PWA:** bisa di-"Add to Home Screen", tampilan fullscreen, manifest dan ikon.
- **Real-time:** order baru muncul di kasir dalam kurang dari 2 detik (Supabase Realtime).
- **Performa:** layar order terbuka kurang dari 2 detik pada koneksi 4G.
- **Keamanan:** Row Level Security di semua tabel, user hanya mengakses data outletnya, tindakan sensitif dicek di sisi server.
- **Bahasa dan format:** UI Bahasa Indonesia, mata uang `Rp 25.000`, zona waktu Asia/Jakarta.
- **Ergonomi:** tombol besar untuk layar sentuh, minimal 44px area tap.
- **Anti-duplikat:** kirim order memakai idempotency key agar tidak terkirim ganda saat sinyal jelek.

**Skala fase 1:** 1 outlet, 100 meja, 5 perangkat kasir, ditambah layar dapur dan layar antar. Koneksi realtime sekitar 100 pelanggan ditambah belasan staf, masih di bawah batas 500 koneksi realtime pada Supabase Pro. Dengan 5 kasir, penguncian dan pengecekan versi di database menjamin satu pembayaran sah per order dan mencegah revisi yang saling menimpa.

## 10. Rekomendasi Teknis

- **Frontend:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui.
- **Backend/DB:** Supabase (Postgres, Auth, Realtime, RLS), dengan project terpisah untuk development dan produksi.
- **State:** TanStack Query untuk data server, state lokal ringan untuk keranjang.
- **Validasi:** Zod.
- **Deploy:** Hostinger VPS KVM 2 dengan Coolify.
- **Rute:** `/login`, `/m/[token]` (pelanggan), `/kasir`, `/order-manual`, `/dapur`, `/antar`, `/dashboard/produk`, `/dashboard/kategori`, `/dashboard/meja`, `/dashboard/transaksi`, `/dashboard/pengaturan`, `/struk/[orderId]`.

Perhitungan total sebaiknya dilakukan di fungsi database atau server action, bukan hanya di klien, agar angka tidak bisa dimanipulasi.

### Hosting: Hostinger VPS KVM 2 + Supabase

Aplikasi web berjalan di VPS Hostinger KVM 2; database, login, dan realtime tetap di Supabase Cloud. Next.js di-deploy lewat Coolify yang terhubung ke GitHub.

- **Development:** Next.js di laptop, terhubung ke project Supabase **dev** (paket Free cukup).
- **Produksi:** Next.js di VPS, terhubung ke project Supabase **produksi** yang terpisah. Pakai paket Pro (mulai $25/bulan) karena paket Free menjeda project setelah 1 minggu tidak aktif dan tanpa backup harian; cek harga terbaru di [halaman harga Supabase](https://supabase.com/pricing).
- Skema database disimpan sebagai file migration di repo agar dev dan produksi identik.
- Server: login SSH dengan key, firewall hanya port 22/80/443, fail2ban, update keamanan otomatis, HTTPS wajib.
- Variabel rahasia (kunci Supabase) hanya di environment variable Coolify, tidak di repository.
- Domain harus stabil: QR yang sudah dicetak mengarah ke domain ini.
- Backup: snapshot VPS dan backup harian Supabase.
- Job kedaluwarsa order (15 menit) berjalan di sisi server, bukan di browser.

## 11. Tahapan Pengerjaan (Task untuk Antigravity)

Kerjakan satu per satu, commit setiap tahap selesai.

1. **Setup:** project Next.js, Tailwind, shadcn/ui, koneksi Supabase dev, `AGENTS.md`.
2. **Database:** migration semua tabel, RLS, `audit_logs` append-only dengan trigger, seed data contoh (10 produk, 3 kategori, 100 meja).
3. **Auth dan role:** login staf, pengalihan berdasarkan role.
4. **Dashboard master data:** kategori, produk, meja dan cetak QR massal, pengaturan outlet, pengaturan pajak dan service charge (kosong, diisi Owner nanti), pengaturan notifikasi email.
5. **Halaman pelanggan `/m/[token]`:** menu, keranjang, kirim pesanan, status dan hitung mundur 15 menit.
6. **Layar Kasir:** order masuk real-time di banyak perangkat, revisi, diskon, pembayaran tunai, pembatalan dan refund, struk.
7. **Job kedaluwarsa** order `PENDING`.
8. **Layar Dapur dan Layar Antar.**
9. **Layar Order Manual, riwayat transaksi,** ringkasan harian (kotor, refund, bersih).
10. **Halaman Jejak Audit** untuk Owner: filter, riwayat per order, ekspor CSV.
11. **Email ke Owner:** laporan bulanan dan notifikasi kejadian sensitif sesuai pengaturan Owner, dengan log pengiriman.
12. **PWA dan uji end-to-end** di iPhone, termasuk uji 5 kasir menekan Bayar bersamaan pada order yang sama.
13. **Setup VPS dan rilis:** Coolify, domain, HTTPS, firewall, project Supabase produksi, deploy, backup.

## 12. Kriteria Penerimaan (MVP Selesai Jika)

- Pelanggan di iPhone dapat scan QR, memesan, dan melihat hitung mundur 15 menit.
- Order muncul di semua layar kasir tanpa refresh dalam kurang dari 2 detik.
- Order yang tidak dibayar menjadi `EXPIRED` setelah 15 menit dan pelanggan melihat pengumuman.
- Jika dua kasir menekan Bayar pada order yang sama, hanya satu yang berhasil.
- Setelah kasir menekan Bayar, order muncul di Layar Dapur; total dan kembalian benar.
- Dapur menandai siap, pelayan menandai sudah diantar, dan pelanggan melihat statusnya berubah.
- Pelanggan dan pelayan tidak bisa mengedit order; hanya kasir yang bisa merevisi sebelum bayar.
- Pajak dan service charge tidak bisa dinyalakan sebelum Owner mengisi persentasenya; saat mati tidak ada pajak di layar mana pun.
- Saat pajak dinyalakan, total di layar pelanggan, kasir, dan struk sama; mengubah persentase tidak mengubah order lama.
- Pembatalan order `PAID` wajib alasan dan menghasilkan refund yang muncul di ringkasan harian.
- Order `SERVED` hanya bisa dibatalkan oleh Owner dengan kategori alasan kesalahan outlet.
- Setiap revisi, diskon, pembayaran, pembatalan, dan perubahan pengaturan muncul di Jejak Audit dengan nilai sebelum dan sesudah.
- Data di `audit_logs` tidak bisa diubah atau dihapus, termasuk oleh Owner.
- Owner menerima laporan bulanan dan email langsung saat ada refund atau pembatalan order yang sudah dibayar, sesuai pengaturan yang dipilih.
- Nomor meja dari QR tidak bisa diubah pelanggan.

## 13. Fase Berikutnya (Backlog)

1. Pembayaran QRIS (Midtrans/Xendit) langsung dari HP pelanggan setelah scan QR.
2. Printer dapur dan printer thermal Bluetooth/LAN.
3. Shift kasir dan rekap kas.
4. Stok dan resep.
5. Modifier/varian (level pedas, ukuran, topping).
6. Laporan lanjutan (produk terlaris, per jam, per metode bayar).
7. Multi-outlet dan mode offline.
8. Penandaan makanan terbuang saat order dibatalkan setelah dimasak.

## 14. Pengaturan yang Diisi Owner

- Persentase pajak, service charge, dan mode harga: diisi Owner di pengaturan saat dibutuhkan.
- Batas diskon maksimum untuk kasir: diisi Owner di pengaturan.
- Pilihan email ke Owner (laporan bulanan dan kejadian sensitif): diatur Owner di pengaturan.
