import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "f&b1621 — Sistem POS, Inventory, & Akuntansi F&B",
  description:
    "Aplikasi POS, Inventory, dan Akuntansi berbasis web (PWA) f&b1621 dengan fitur self-order QR meja, QRIS dinamis, layar kasir, KDS, gudang, dan laporan keuangan lengkap.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "f&b1621",
  },
  icons: {
    icon: "/icon.svg",
    apple: "/icon.svg",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#18181b",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-zinc-50 text-zinc-950 antialiased">
        <QueryProvider>
          <PwaRegister />
          {children}
          <Toaster position="top-center" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
