import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "f&b1621 — Sistem POS, Inventory, & Akuntansi F&B",
    short_name: "f&b1621",
    description:
      "Aplikasi POS, Inventory, dan Akuntansi F&B berbasis web (PWA) dengan 100 meja QR, QRIS Dinamis, Layar Kasir, KDS, Gudang, dan Laporan Keuangan 5 Tab.",
    start_url: "/login",
    display: "standalone",
    orientation: "any",
    background_color: "#fafafa",
    theme_color: "#18181b",
    lang: "id-ID",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icon.svg",
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}

