import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import { PwaRegister } from "@/components/pwa/pwa-register";
import { NavigationLoadingIndicator } from "@/components/ui/navigation-loading-indicator";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

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
    icon: "/logo-1621group-stacked.png",
    apple: "/logo-1621group-stacked.png",
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
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                const stored = localStorage.getItem('fnb1621_theme');
                const theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} font-sans min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased text-[16px]`}
      >
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
