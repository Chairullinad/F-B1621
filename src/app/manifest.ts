import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "1621F&B — Sistem POS, Inventory, & Akuntansi F&B",
    short_name: "1621F&B",
    description:
      "Aplikasi POS, Inventory, dan Akuntansi F&B berbasis web (PWA) 1621F&B dengan 100 meja QR, QRIS Dinamis, Layar Kasir, KDS, Gudang, dan Laporan Keuangan 5 Tab.",
    start_url: "/login",
    display: "standalone",
    orientation: "any",
    background_color: "#0F1B27",
    theme_color: "#3B7097",
    lang: "id-ID",
    icons: [
      {
        src: "/logo-1621.png",
        sizes: "any",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/logo-1621.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
