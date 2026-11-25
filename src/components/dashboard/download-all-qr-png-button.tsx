"use client";

import * as React from "react";
import { Archive, Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  downloadAllQrStandeeSeparately,
  downloadAllQrStandeeZip,
} from "@/lib/qr-standee-png";

interface DownloadAllQrPngButtonProps {
  outletName: string;
  outletLogoUrl: string;
  outletThemeColor: string;
  tables: ReadonlyArray<{
    tableNo: number;
    qrToken: string;
  }>;
  showSeparateOption?: boolean;
}

export function DownloadAllQrPngButton({
  outletName,
  outletLogoUrl,
  outletThemeColor,
  tables,
  showSeparateOption = true,
}: DownloadAllQrPngButtonProps) {
  const [mode, setMode] = React.useState<"zip" | "separate" | null>(null);
  const [progress, setProgress] = React.useState<{
    done: number;
    total: number;
  } | null>(null);

  const isBusy = mode !== null;

  const buildPayload = () => {
    const origin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";
    return {
      outletName,
      outletLogoUrl,
      outletThemeColor,
      tables: tables.map((t) => ({
        tableNo: t.tableNo,
        qrUrl: `${origin}/m/${t.qrToken}`,
      })),
    };
  };

  const handleDownloadZip = async () => {
    if (isBusy || tables.length === 0) return;
    setMode("zip");
    setProgress({ done: 0, total: tables.length });
    try {
      const zipFilename = await downloadAllQrStandeeZip(
        buildPayload(),
        (done, total) => setProgress({ done, total })
      );
      toast.success(
        `${tables.length} gambar PNG dikemas ke ${zipFilename} (ekstrak ZIP untuk melihat semua file).`
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal membuat file ZIP gambar."
      );
    } finally {
      setMode(null);
      setProgress(null);
    }
  };

  const handleDownloadSeparate = async () => {
    if (isBusy || tables.length === 0) return;
    setMode("separate");
    setProgress({ done: 0, total: tables.length });
    toast.info(
      "Memulai unduhan berurutan. Jika browser meminta izin 'Izinkan beberapa file', klik Allow."
    );
    try {
      const count = await downloadAllQrStandeeSeparately(
        buildPayload(),
        (done, total) => setProgress({ done, total })
      );
      toast.success(`Selesai mengunduh ${count} file gambar PNG meja.`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Gagal mengunduh file PNG."
      );
    } finally {
      setMode(null);
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        disabled={isBusy || tables.length === 0}
        onClick={handleDownloadZip}
        className="bg-[#1E88E5] hover:bg-[#1976D2] text-white"
      >
        <Archive className="mr-1.5 h-4 w-4 shrink-0" />
        <span>
          {mode === "zip" && progress
            ? `Menyiapkan ZIP (${progress.done}/${progress.total})...`
            : `Simpan Semua PNG (${tables.length} Meja .ZIP)`}
        </span>
      </Button>

      {showSeparateOption ? (
        <Button
          type="button"
          variant="outline"
          disabled={isBusy || tables.length === 0}
          onClick={handleDownloadSeparate}
          title="Unduh file PNG terpisah langsung satu per satu (memerlukan izin multiple download di browser)"
        >
          <Download className="mr-1.5 h-4 w-4 shrink-0" />
          <span>
            {mode === "separate" && progress
              ? `Mengunduh (${progress.done}/${progress.total})...`
              : `Unduh 1 per 1 (${tables.length})`}
          </span>
        </Button>
      ) : null}
    </div>
  );
}
