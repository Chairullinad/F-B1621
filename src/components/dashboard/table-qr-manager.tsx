"use client";

import * as React from "react";
import Link from "next/link";
import { QrCode, Printer, ExternalLink, RefreshCw, Power, Palette, X } from "lucide-react";
import { toast } from "sonner";
import { DownloadAllQrPngButton } from "@/components/dashboard/download-all-qr-png-button";
import { DownloadQrPngButton } from "@/components/dashboard/download-qr-png-button";
import { TableQrStandeeCard } from "@/components/dashboard/table-qr-standee-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { generateQrSvgString } from "@/lib/qrcode";
import type { TableRow } from "@/lib/types/database";
import {
  regenerateTableQrTokenAction,
  toggleTableActiveAction,
} from "@/server/master-data";

export function TableQrManager({
  initialTables,
  outletId,
  outletName,
  outletLogoUrl = "/logo-1621group-stacked.png",
  outletThemeColor = "#0284C7",
}: {
  initialTables: ReadonlyArray<TableRow>;
  outletId?: string;
  outletName: string;
  outletLogoUrl?: string;
  outletThemeColor?: string;
}) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedTable, setSelectedTable] = React.useState<TableRow | null>(
    null
  );
  const [origin, setOrigin] = React.useState("http://localhost:3000");
  const [isPending, startTransition] = React.useTransition();

  React.useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  React.useEffect(() => {
    if (!selectedTable) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedTable(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTable]);

  const filteredTables = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return initialTables;
    return initialTables.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        String(t.table_no) === q ||
        t.qr_token.toLowerCase().includes(q)
    );
  }, [initialTables, searchQuery]);

  function handleRegenerateQr(table: TableRow) {
    startTransition(async () => {
      const res = await regenerateTableQrTokenAction({ id: table.id });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
      setSelectedTable(null);
    });
  }

  function handleToggleActive(table: TableRow) {
    startTransition(async () => {
      const res = await toggleTableActiveAction({
        id: table.id,
        isActive: !table.is_active,
      });
      if (!res.ok) {
        toast.error(res.message);
        return;
      }
      toast.success(res.message);
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="text-base">
              Daftar 100 Meja Tetap ({filteredTables.length} /{" "}
              {initialTables.length})
            </CardTitle>
            <CardDescription>
              Nomor meja bersifat tetap dan ditentukan server dari token QR
              acak. Jika QR bocor/rusak, klik <strong>Ganti Token QR</strong>{" "}
              agar QR lama otomatis tidak berlaku.
            </CardDescription>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <DownloadAllQrPngButton
              outletName={outletName}
              outletLogoUrl={outletLogoUrl}
              outletThemeColor={outletThemeColor}
              tables={initialTables
                .filter((t) => t.is_active)
                .map((t) => ({
                  tableNo: t.table_no,
                  qrToken: t.qr_token,
                }))}
              showSeparateOption={false}
            />
            <Button asChild size="default">
              <Link href="/dashboard/meja/cetak">
                Cetak Massal Semua QR (100 Meja)
              </Link>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="max-w-sm">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nomor meja (contoh: Meja 7 atau 7)..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTables.map((table) => (
              <div
                key={table.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EBF5FF] dark:bg-sky-950/60 text-xs font-extrabold text-[#1B5E86] dark:text-sky-300">
                        {table.table_no}
                      </span>
                      <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                        {table.name}
                      </span>
                    </div>
                    <Badge
                      variant={table.is_active ? "success" : "destructive"}
                    >
                      {table.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <p
                    className="truncate font-mono text-xs text-slate-500 dark:text-slate-400"
                    title={table.qr_token}
                  >
                    Token: {table.qr_token.slice(0, 16)}...
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedTable(table)}
                  >
                    <QrCode className="mr-1 h-3.5 w-3.5" />
                    Lihat QR
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/meja/cetak?table=${table.table_no}`}>
                      <Printer className="mr-1 h-3.5 w-3.5" />
                      Cetak
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleRegenerateQr(table)}
                  >
                    <RefreshCw className="mr-1 h-3.5 w-3.5" />
                    Ganti Token
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleToggleActive(table)}
                  >
                    <Power className="mr-1 h-3.5 w-3.5" />
                    {table.is_active ? "Nonaktifkan" : "Aktifkan"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Modal Pop-up Pratinjau Standee QR Meja */}
      {selectedTable ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-standee-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-150"
          onClick={() => setSelectedTable(null)}
        >
          <div
            className="w-full max-w-3xl rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden my-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <Badge variant="default">Pratinjau Standee QR Meja</Badge>
                <h2
                  id="qr-standee-modal-title"
                  className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 truncate"
                >
                  {selectedTable.name} &mdash; {outletName}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setSelectedTable(null)}
                aria-label="Tutup pop-up QR"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-800 dark:hover:text-slate-100 cursor-pointer transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Body Modal: Standee Besar Kiri + Aksi & Detail Kanan */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-5 sm:p-6 items-center">
              <div className="md:col-span-7 flex justify-center">
                <TableQrStandeeCard
                  outletName={outletName}
                  outletLogoUrl={outletLogoUrl}
                  outletThemeColor={outletThemeColor}
                  tableNo={selectedTable.table_no}
                  qrSvg={generateQrSvgString(
                    `${origin}/m/${selectedTable.qr_token}`,
                    2
                  )}
                />
              </div>

              <div className="md:col-span-5 space-y-4">
                <div className="space-y-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    URL Tujuan Pelanggan
                  </div>
                  <Link
                    href={`/m/${selectedTable.qr_token}`}
                    target="_blank"
                    className="block font-mono text-xs text-[#1E88E5] underline break-all"
                  >
                    {origin}/m/{selectedTable.qr_token}
                  </Link>
                </div>

                <div className="space-y-1 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Warna Latar Aktif:</span>
                    <span className="inline-flex items-center gap-1.5 font-mono font-bold text-slate-800 dark:text-slate-100">
                      <span
                        className="inline-block h-3.5 w-3.5 rounded-full border border-slate-300"
                        style={{ backgroundColor: outletThemeColor }}
                      />
                      {outletThemeColor.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    Logo usaha &amp; warna mengikuti pengaturan pada menu Setting Outlet.
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  <DownloadQrPngButton
                    outletName={outletName}
                    outletLogoUrl={outletLogoUrl}
                    outletThemeColor={outletThemeColor}
                    tableNo={selectedTable.table_no}
                    qrToken={selectedTable.qr_token}
                    variant="default"
                    className="h-11 w-full bg-[#1E88E5] hover:bg-[#1976D2] text-white"
                  />

                  <Button
                    asChild
                    variant="outline"
                    size="default"
                    className="h-11 w-full"
                  >
                    <Link
                      href={`/dashboard/meja/cetak?table=${selectedTable.table_no}`}
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Cetak QR {selectedTable.name}
                    </Link>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    size="default"
                    className="h-11 w-full"
                  >
                    <Link
                      href={`/m/${selectedTable.qr_token}`}
                      target="_blank"
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Simulasi Scan Pelanggan
                    </Link>
                  </Button>

                  {outletId && (
                    <Button
                      asChild
                      variant="outline"
                      size="default"
                      className="h-11 w-full"
                    >
                      <Link
                        href={`/dashboard/cabang?edit=${encodeURIComponent(outletId)}`}
                      >
                        <Palette className="mr-2 h-4 w-4" />
                        Ubah Warna &amp; Logo Outlet
                      </Link>
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    className="h-11 w-full"
                    onClick={() => setSelectedTable(null)}
                  >
                    Tutup Pop-up
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
