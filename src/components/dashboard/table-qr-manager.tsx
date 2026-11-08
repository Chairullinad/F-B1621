"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { QrCode, Printer, ExternalLink, RefreshCw, Power } from "lucide-react";
import { toast } from "sonner";
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
  outletName,
}: {
  initialTables: ReadonlyArray<TableRow>;
  outletName: string;
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

          {selectedTable ? (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-900/50 p-5">
              <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default">Pratinjau Standee QR Meja</Badge>
                    <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                      {selectedTable.name} — {outletName}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 break-all">
                    URL Tujuan Pelanggan:{" "}
                    <Link
                      href={`/m/${selectedTable.qr_token}`}
                      target="_blank"
                      className="font-mono text-[#1E88E5] underline"
                    >
                      {origin}/m/{selectedTable.qr_token}
                    </Link>
                  </p>
                  <p className="text-xs text-slate-500 max-w-md">
                    Desain stiker meja resmi dilengkapi dengan identitas <strong>1621 Group</strong>, nama cabang, nomor meja, dan panduan pemesanan mandiri 3 langkah.
                  </p>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button asChild size="sm">
                      <Link
                        href={`/dashboard/meja/cetak?table=${selectedTable.table_no}`}
                      >
                        <Printer className="mr-1.5 h-3.5 w-3.5" />
                        Cetak QR {selectedTable.name}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/m/${selectedTable.qr_token}`}
                        target="_blank"
                      >
                        <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                        Simulasi Scan Pelanggan
                      </Link>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedTable(null)}
                    >
                      Tutup Pratinjau
                    </Button>
                  </div>
                </div>

                {/* Kartu Pratinjau Standee Meja Branded 1621 Group */}
                <div className="flex w-64 shrink-0 flex-col items-center justify-between overflow-hidden rounded-2xl border-2 border-[#1B5E86] bg-white p-4 text-center shadow-md">
                  <div className="flex w-full flex-col items-center border-b border-slate-100 pb-2.5">
                    <Image
                      src="/logo-1621group.png"
                      alt="1621 Group"
                      width={132}
                      height={37}
                      className="h-8 w-auto object-contain"
                    />
                    <span className="mt-1 rounded-full bg-[#EBF5FF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1B5E86]">
                      {outletName}
                    </span>
                  </div>

                  <div className="my-2.5">
                    <span className="inline-block rounded-lg bg-[#1B5E86] px-4 py-1 text-base font-extrabold tracking-wide text-white uppercase shadow-xs">
                      {selectedTable.name}
                    </span>
                  </div>

                  <div
                    className="h-40 w-40 rounded-xl border-2 border-slate-200 bg-white p-2 shadow-2xs"
                    dangerouslySetInnerHTML={{
                      __html: generateQrSvgString(
                        `${origin}/m/${selectedTable.qr_token}`
                      ),
                    }}
                  />

                  <div className="mt-3 w-full space-y-1 border-t border-slate-100 pt-2.5">
                    <p className="text-[11px] font-bold text-slate-900">
                      SCAN UNTUK PESAN DI MEJA
                    </p>
                    <p className="text-[10px] font-medium text-slate-500">
                      1. Scan QR &bull; 2. Pilih Menu &bull; 3. Bayar
                    </p>
                    <p className="font-mono text-[9px] text-slate-400">
                      1621 GROUP POS &bull; #{selectedTable.table_no}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTables.map((table) => (
              <div
                key={table.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-2xs"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[#EBF5FF] text-xs font-extrabold text-[#1B5E86]">
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
                    className="truncate font-mono text-xs text-slate-500"
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
    </div>
  );
}
