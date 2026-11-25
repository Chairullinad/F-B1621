"use client";

import * as React from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadQrStandeePng } from "@/lib/qr-standee-png";

interface DownloadQrPngButtonProps {
  outletName: string;
  outletLogoUrl: string;
  outletThemeColor: string;
  tableNo: number;
  qrToken: string;
  label?: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm";
  className?: string;
}

export function DownloadQrPngButton({
  outletName,
  outletLogoUrl,
  outletThemeColor,
  tableNo,
  qrToken,
  label = "Simpan Gambar (PNG)",
  variant = "outline",
  size = "default",
  className,
}: DownloadQrPngButtonProps) {
  const [isDownloading, setIsDownloading] = React.useState(false);

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      const origin =
        typeof window !== "undefined"
          ? window.location.origin
          : "http://localhost:3000";
      const filename = await downloadQrStandeePng({
        outletName,
        outletLogoUrl,
        outletThemeColor,
        tableNo,
        qrUrl: `${origin}/m/${qrToken}`,
      });
      toast.success(`Gambar standee disimpan: ${filename}`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal menyimpan gambar PNG."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={isDownloading}
      onClick={handleDownload}
      className={className}
    >
      <Download className="mr-1.5 h-4 w-4 shrink-0" />
      <span>{isDownloading ? "Menyiapkan PNG..." : label}</span>
    </Button>
  );
}
