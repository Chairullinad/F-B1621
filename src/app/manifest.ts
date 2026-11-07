import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "POS 1621 F&B — Sistem Kasir & Self-Order QR",
    short_name: "POS 1621 F&B",
    description:
      "Aplikasi POS berbasis web (PWA) untuk restoran dan kafe dengan 100 meja QR, Layar Kasir, Layar Dapur, Layar Antar, dan Audit Trail.",
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
