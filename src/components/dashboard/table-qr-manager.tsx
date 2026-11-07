"use client";

import * as React from "react";
import Link from "next/link";
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
            <div className="rounded-xl border-2 border-zinc-900 bg-zinc-50 p-5">
              <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="default">Pratinjau QR Meja</Badge>
                    <span className="text-lg font-bold">
                      {selectedTable.name} — {outletName}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-600 break-all">
                    URL Tujuan:{" "}
                    <Link
                      href={`/m/${selectedTable.qr_token}`}
                      target="_blank"
                      className="font-mono underline"
                    >
                      {origin}/m/{selectedTable.qr_token}
                    </Link>
                  </p>
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button asChild size="sm">
                      <Link
                        href={`/dashboard/meja/cetak?table=${selectedTable.table_no}`}
                      >
                        Cetak QR {selectedTable.name}
                      </Link>
                    </Button>
                    <Button asChild variant="outline" size="sm">
                      <Link
                        href={`/m/${selectedTable.qr_token}`}
                        target="_blank"
                      >
                        Uji Buka Halaman Pelanggan
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

                <div
                  className="h-44 w-44 shrink-0 rounded-lg border border-zinc-200 bg-white p-2 shadow-xs"
                  dangerouslySetInnerHTML={{
                    __html: generateQrSvgString(
                      `${origin}/m/${selectedTable.qr_token}`
                    ),
                  }}
                />
              </div>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTables.map((table) => (
              <div
                key={table.id}
                className="flex flex-col justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-base font-bold">{table.name}</span>
                    <Badge
                      variant={table.is_active ? "success" : "destructive"}
                    >
                      {table.is_active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </div>
                  <p
                    className="truncate font-mono text-xs text-zinc-500"
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
                    Lihat QR
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/dashboard/meja/cetak?table=${table.table_no}`}>
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
                    Ganti Token
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleToggleActive(table)}
                  >
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
