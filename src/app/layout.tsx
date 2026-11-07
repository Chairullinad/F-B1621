import type { Metadata, Viewport } from "next";
import { Toaster } from "sonner";
import { QueryProvider } from "@/components/providers/query-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "POS 1621 F&B — Sistem Kasir & Self-Order QR",
  description:
    "Aplikasi POS berbasis web (PWA) untuk restoran dan kafe dengan fitur self-order QR meja, layar kasir, layar dapur, layar antar, dan audit trail.",
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
          {children}
          <Toaster position="top-center" richColors />
        </QueryProvider>
      </body>
    </html>
  );
}

