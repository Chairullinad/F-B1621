#!/usr/bin/env bash
# ============================================================================
# Skrip Hardening & Persiapan VPS Hostinger KVM 2 (Ubuntu 24.04 LTS)
# Proyek: POS 1621 F&B Web
# Sesuai PRD Bagian 10:
# - Zona waktu Asia/Jakarta
# - Firewall UFW hanya membuka port 22 (SSH), 80 (HTTP), dan 443 (HTTPS)
# - Fail2ban aktif untuk proteksi brute-force SSH
# - Pembaruan keamanan otomatis (unattended-upgrades)
# - Instalasi Coolify
# ============================================================================

set -euo pipefail

echo "=== [1/6] Mengatur zona waktu server ke Asia/Jakarta (WIB) ==="
timedatectl set-timezone Asia/Jakarta

echo "=== [2/6] Memperbarui paket sistem & menginstal utilitas keamanan ==="
apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  ufw \
  fail2ban \
  unattended-upgrades \
  apt-listchanges \
  curl \
  ca-certificates

echo "=== [3/6] Mengaktifkan pembaruan keamanan otomatis (unattended-upgrades) ==="
dpkg-reconfigure -f noninteractive unattended-upgrades

echo "=== [4/6] Mengonfigurasi Firewall UFW (Hanya Port 22, 80, 443) ==="
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP Coolify/Traefik'
ufw allow 443/tcp comment 'HTTPS Coolify/Traefik'
ufw --force enable
ufw status verbose

echo "=== [5/6] Mengaktifkan layanan Fail2ban ==="
systemctl enable fail2ban
systemctl restart fail2ban

echo "=== [6/6] Menginstal Coolify (Self-Hosted PaaS) ==="
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash

echo "============================================================================"
echo "SELESAI! VPS Hostinger KVM 2 telah diamankan dan Coolify telah terpasang."
echo "Langkah berikutnya: Hubungkan domain ke Coolify dan ikuti DEPLOYMENT.md."
echo "============================================================================"

