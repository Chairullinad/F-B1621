// Service Worker POS 1621 F&B (PWA)
// Sesuai aturan Fase 1 (tanpa mode offline untuk data transaksi agar saldo & status order selalu real-time dari server)

const SW_VERSION = "pos-1621-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Biarkan seluruh request diteruskan langsung ke jaringan (network-first/pass-through)
  // supaya tidak pernah menyajikan status order atau harga basi
  if (event.request.method !== "GET") return;
});
