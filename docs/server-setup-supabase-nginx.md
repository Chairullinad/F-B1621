# Dokumentasi Setup Server: Supabase + Coolify via Nginx Reverse Proxy

**Tanggal:** 27 November 2026  
**Server:** VPS Hostinger KVM2 (`srv2193752`)  
**Domain:** `1621fnb.com`  
**Subdomain aktif:** `supabase.1621fnb.com`, `coolify.1621fnb.com`

---

## Latar Belakang

Awalnya Coolify menjalankan Traefik sebagai reverse proxy bawaannya. Ketika Supabase dikonfigurasi agar bisa diakses via subdomain (`supabase.1621fnb.com`), terjadi **konflik port 80/443** antara Traefik (Coolify) dan upaya instalasi Nginx. Solusinya: **Nginx dijadikan reverse proxy tunggal di depan**, Traefik/Coolify di-bypass untuk port publik.

---

## Kronologi & Langkah-Langkah

### 1. Persiapan Awal

```bash
apt-get update && apt-get install -y git
```

- Update package list dan install Git.

---

### 2. Eksplorasi & Konfigurasi Supabase (Awal)

```bash
cd supabase-project/
nano docker-compose.yml
docker compose down
docker compose up -d
docker ps
curl -i localhost:8001
curl -i 127.0.0.1:8001
```

- Supabase dijalankan via Docker Compose dari folder `~/supabase-project/`.
- Dicek apakah API Supabase merespons di port **8001** (port internal Kong/Envoy gateway).
- `curl -i 127.0.0.1:8001` → memastikan container berjalan dan gateway aktif.

---

### 3. Instalasi Nginx & Certbot (Percobaan Pertama — Gagal karena Konflik Port)

```bash
sudo apt install nginx certbot python3-certbot -y
netstat -lpn | grep :80
netstat -lpn | grep :443
docker ps
```

- Ditemukan bahwa **port 80 dan 443 sudah ditempati** oleh container Coolify/Traefik.
- Container yang memblokir dihentikan sementara:

```bash
docker stop 078e9971ec39   # container Traefik/Coolify yang menempati port 80/443
```

---

### 4. Konfigurasi Nginx Sites

```bash
cd /etc/nginx/sites-enabled/
rm default                   # hapus konfigurasi default Nginx

cd /etc/nginx/sites-available/
nano coolify                 # buat config reverse proxy untuk coolify.1621fnb.com
nano supabase                # buat config reverse proxy untuk supabase.1621fnb.com

cd /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/coolify
sudo ln -s /etc/nginx/sites-available/supabase

sudo nginx -t                # validasi konfigurasi
systemctl restart nginx
```

**Isi konfigurasi Nginx untuk Supabase** (`/etc/nginx/sites-available/supabase`):

```nginx
server {
    listen 80;
    server_name supabase.1621fnb.com;

    location / {
        proxy_pass http://127.0.0.1:8001;   # port internal Kong/Envoy Supabase
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Isi konfigurasi Nginx untuk Coolify** (`/etc/nginx/sites-available/coolify`):

```nginx
server {
    listen 80;
    server_name coolify.1621fnb.com;

    location / {
        proxy_pass http://127.0.0.1:3000;   # port internal Coolify
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

### 5. Pasang SSL dengan Certbot

```bash
apt install python3-certbot-nginx -y

# Pasang SSL untuk Supabase
certbot --nginx -d supabase.1621fnb.com

# Pasang SSL untuk Coolify
certbot --nginx -d coolify.1621fnb.com

systemctl restart nginx
```

> [!NOTE]
> Percobaan `certbot -d supabase.1621fnb.com coolify.1621fnb.com` (tanpa flag `--nginx`) gagal — pastikan selalu pakai `--nginx` agar Certbot otomatis memodifikasi config Nginx untuk HTTPS.

---

### 6. Konfigurasi Ulang Supabase `.env`

```bash
cd ~/supabase-project/
nano .env
docker compose down
docker compose up -d
```

- Variabel penting yang diedit di `.env` Supabase:

```env
# Ganti URL publik agar Supabase tahu domain-nya
SITE_URL=https://supabase.1621fnb.com
API_EXTERNAL_URL=https://supabase.1621fnb.com

# Port internal (jangan diekspos ke publik langsung)
# Kong/Envoy tetap listen di 8001, Nginx yang forward dari 443
```

- Diverifikasi dengan:

```bash
grep -n -i -E '8000|8443|HTTP_PORT|HTTPS_PORT' .env docker-compose.yml
```

---

### 7. Verifikasi Akhir

```bash
docker ps          # pastikan semua container Supabase running
curl -i -H 'Host: supabase.1621fnb.com' http://127.0.0.1:8001   # test langsung ke gateway
```

---

### 8. Reset & Reinstall Docker + Supabase (Jika Diperlukan)

Jika ada masalah besar, langkah reset yang dilakukan:

```bash
sudo apt purge *docker*
apt install docker.io docker-compose-v2

# Hapus folder lama dan setup ulang dengan script resmi Supabase
rm -r supabase-project/
curl -fsSL https://supabase.link/setup.sh | sh
```

---

## Troubleshooting: Error 502 Bad Gateway — Envoy Port Salah Petakan

### Root Cause

Gejala: `supabase.1621fnb.com` mengembalikan **502 Bad Gateway** meski semua container berstatus `Up`/`healthy`.

Penyebabnya: di `docker-compose.yml`, service `api-gw` memetakan port **8001 → 8001**, padahal **Envoy mendengarkan di port 8000 di dalam container**. Healthcheck hanya mengecek koneksi TCP (bukan HTTP), sehingga status `healthy` tidak menjamin port terpetakan benar.

**Verifikasi dugaan:**

```bash
curl -i http://127.0.0.1:8001/
```

| Respons | Artinya |
|---|---|
| `Connection reset by peer` / `Empty reply` | Dugaan benar — port salah petakan |
| `401 Unauthorized` | Envoy normal, masalah ada di Nginx |

---

### Pemetaan Port yang Salah vs Benar

| Service | Port di compose (salah) | Port di compose (benar) |
|---|---|---|
| `api-gw → ports` | `...8001:8001/tcp` | `127.0.0.1:8001:8000/tcp` |
| `studio → SUPABASE_URL` | `http://api-gw:8001` | `http://api-gw:8000` |
| `functions → SUPABASE_URL` | `http://api-gw:8001` | `http://api-gw:8000` |

> [!NOTE]
> Port **8001** di sisi host (kiri) tetap dipakai agar tidak bentrok dengan port 8000 yang sudah ditempati Coolify. Hanya port di dalam container (kanan) yang diubah ke **8000**, sesuai port listener Envoy yang sebenarnya. Komunikasi antar-container tetap pakai port **8000**.

---

### Langkah Perbaikan

**1. Edit `docker-compose.yml` — service `api-gw`:**

```yaml
api-gw:
  ports:
    - "127.0.0.1:${API_GW_HTTP_PORT:-${KONG_HTTP_PORT:-8000}}:8000/tcp"
    # Sisi kiri (host): 8001 via variabel API_GW_HTTP_PORT di .env
    # Sisi kanan (container): 8000 — port listener Envoy yang sebenarnya
```

**Setel `studio` dan `functions`:**

```yaml
# Di service studio dan functions:
SUPABASE_URL: http://api-gw:8000
```

**2. Edit `.env` — tambahkan variabel port:**

```env
# Port host tetap 8001 karena 8000 dipakai Coolify
API_GW_HTTP_PORT=8001
```

**3. Apply dengan sed (atau edit manual):**

```bash
cd ~/supabase-project
cp docker-compose.yml docker-compose.yml.bak    # backup dulu!

sed -i 's|:8001/tcp|:8000/tcp|; s|http://api-gw:8001|http://api-gw:8000|g' docker-compose.yml
sed -i 's|- ${API_GW_HTTP_PORT|- 127.0.0.1:${API_GW_HTTP_PORT|' docker-compose.yml

docker compose up -d
```

**4. Verifikasi:**

```bash
docker ps --filter name=supabase-envoy --format '{{.Ports}}'
# Harus tampil: 127.0.0.1:8001->8000/tcp

curl -i http://127.0.0.1:8001/
# Harus tampil: 401 Unauthorized  ← gateway sudah normal
```

---

### Konfigurasi Nginx Supabase yang Benar (Lengkap)

Setelah gateway normal, pastikan Nginx menggunakan config berikut (termasuk WebSocket support untuk Realtime):

```nginx
map $http_upgrade $connection_upgrade_sb {
    default upgrade;
    ''      close;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name supabase.1621fnb.com;

    # ssl_certificate /etc/letsencrypt/live/supabase.1621fnb.com/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/supabase.1621fnb.com/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:8001;    # http, bukan https
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade_sb;
        proxy_buffer_size 16k;
        proxy_buffers 8 16k;
        proxy_read_timeout 3600s;
    }
}

# Redirect HTTP ke HTTPS (Certbot akan menambahkan ini otomatis)
server {
    listen 80;
    listen [::]:80;
    server_name supabase.1621fnb.com;
    return 301 https://$host$request_uri;
}
```

> [!IMPORTANT]
> Blok `map $http_upgrade ...` **hanya boleh ada satu** di Nginx. Jika sudah ada di file config lain, jangan ditulis ulang — cukup referensikan variabel `$connection_upgrade_sb` yang sudah dideklarasikan di file ini.

```bash
nginx -t && systemctl reload nginx
```

---

### Verifikasi `.env` Supabase

Pastikan variabel URL sudah memakai domain HTTPS:

```env
SUPABASE_PUBLIC_URL=https://supabase.1621fnb.com
API_EXTERNAL_URL=https://supabase.1621fnb.com/auth/v1
SITE_URL=https://1621fnb.com   # URL aplikasi utama, bukan subdomain Supabase
```

Setelah edit `.env`, jalankan: `docker compose up -d`

---

### Jika Masih 502 — Perintah Diagnosis

```bash
# Log error Nginx
tail -n 20 /var/log/nginx/error.log

# Verifikasi config compose yang aktif
docker compose config | grep -A25 "api-gw:"

# Log Envoy
docker logs --tail 30 supabase-envoy
```

---

### Catatan Keamanan Tambahan

> [!CAUTION]
> **Port database terbuka ke internet!** `supabase-pooler` kemungkinan memetakan `0.0.0.0:5432` dan `0.0.0.0:6543`. Batasi ke localhost agar hanya bisa diakses dari server:
>
> ```yaml
> # Di docker-compose.yml, service supabase-pooler:
> ports:
>   - "127.0.0.1:5432:5432"
>   - "127.0.0.1:6543:6543"
> ```
>
> UFW biasanya **tidak memblokir** port yang dipublikasikan Docker. Pembatasan di `docker-compose.yml` lebih pasti daripada aturan UFW.

---

## Arsitektur Akhir

```
Internet (HTTPS :443)
        │
        ▼
   [ Nginx ]  ← satu-satunya reverse proxy yang menghadap publik
   /         \
   ▼           ▼
Supabase     Coolify
(127.0.0.1   (127.0.0.1
  :8001)       :3000)
```

> [!IMPORTANT]
> Coolify **tidak lagi** mengontrol port 80/443. Pastikan di pengaturan Coolify, Traefik dikonfigurasi agar **tidak** bind ke port 80/443 (atau dinonaktifkan sepenuhnya), supaya tidak konflik dengan Nginx saat restart server.

---

## Poin Penting & Catatan

| Hal | Detail |
|---|---|
| Gateway Supabase internal | `127.0.0.1:8001` (Kong atau Envoy) |
| Coolify internal port | `127.0.0.1:3000` |
| SSL provider | Let's Encrypt via Certbot |
| Reverse proxy publik | Nginx (bukan Traefik) |
| Risiko utama | Coolify restart bisa menghidupkan Traefik kembali dan merebut port 80/443 |

> [!WARNING]
> Setiap kali **Coolify diupdate atau direstart**, periksa apakah Traefik kembali aktif dan merebut port 80/443. Jalankan `netstat -lpn | grep ':80\|:443'` untuk memverifikasi.

> [!TIP]
> Tambahkan `systemctl enable nginx` agar Nginx otomatis start saat server reboot, dan pastikan container Docker Supabase juga di-set restart policy `unless-stopped` di `docker-compose.yml`.

---

## Perintah Monitoring Harian

```bash
# Cek semua container aktif
docker ps

# Cek Nginx berjalan normal
systemctl status nginx

# Cek siapa yang menempati port 80 dan 443
netstat -lpn | grep ':80\|:443'

# Cek log Supabase gateway
docker logs --tail=60 supabase-envoy

# Test konektivitas HTTPS
curl -I https://supabase.1621fnb.com
curl -I https://coolify.1621fnb.com
```
