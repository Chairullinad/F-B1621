import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { NavigationLoadingIndicator } from "@/components/ui/navigation-loading-indicator";
import "./globals.css";

export const metadata: Metadata = {
  title: "1621F&B — Sistem POS, Inventory, & Akuntansi F&B",
  description:
    "Aplikasi POS, Inventory, dan Akuntansi berbasis web (PWA) 1621F&B dengan fitur self-order QR meja, QRIS dinamis, layar kasir, KDS, gudang, dan laporan keuangan lengkap.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "1621F&B",
  },
  icons: {
    icon: "/logo-1621.png",
    apple: "/logo-1621.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#3B7097",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        <QueryProvider>
          <PwaRegister />
          <Suspense fallback={null}>
            <NavigationLoadingIndicator />
          </Suspense>
          {children}
          <Toaster position="top-center" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}
