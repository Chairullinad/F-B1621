"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Layers, Printer, Search } from "lucide-react";
import { DownloadQrPngButton } from "@/components/dashboard/download-qr-png-button";
import { TableQrStandeeCard } from "@/components/dashboard/table-qr-standee-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { generateQrSvgString } from "@/lib/qrcode";

export interface BatchQrTableItem {
  id: string;
  tableNo: number;
  name: string;
  qrToken: string;
}

interface BatchTableQrPrintGridProps {
  tables: ReadonlyArray<BatchQrTableItem>;
  outletName: string;
  outletLogoUrl: string;
  outletThemeColor: string;
  baseUrl: string;
}

const BATCH_SIZE = 24;

export function BatchTableQrPrintGrid({
  tables,
  outletName,
  outletLogoUrl,
  outletThemeColor,
  baseUrl,
}: BatchTableQrPrintGridProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [currentPage, setCurrentPage] = React.useState(1);
  const [showAll, setShowAll] = React.useState(tables.length <= BATCH_SIZE);
  const [pendingPrintAll, setPendingPrintAll] = React.useState(false);

  const filteredTables = React.useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tables;
    return tables.filter(
      (t) =>
        String(t.tableNo).includes(q) ||
        t.name.toLowerCase().includes(q)
    );
  }, [tables, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredTables.length / BATCH_SIZE));
  const safePage = Math.min(currentPage, totalPages);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const visibleTables = React.useMemo(() => {
    if (showAll || filteredTables.length <= BATCH_SIZE) {
      return filteredTables;
    }
    const startIdx = (safePage - 1) * BATCH_SIZE;
    return filteredTables.slice(startIdx, startIdx + BATCH_SIZE);
  }, [filteredTables, safePage, showAll]);

  // Generate SVG QR hanya untuk kartu meja yang sedang tampil agar 100+ meja tetap ringan
  const renderedCards = React.useMemo(() => {
    return visibleTables.map((table) => ({
      table,
      svgMarkup: generateQrSvgString(`${baseUrl}/m/${table.qrToken}`, 2),
    }));
  }, [visibleTables, baseUrl]);

  React.useEffect(() => {
    if (!pendingPrintAll || !showAll) return;
    let raf2 = 0;
    const raf1 = window.requestAnimationFrame(() => {
      raf2 = window.requestAnimationFrame(() => {
        setPendingPrintAll(false);
        window.print();
      });
    });
    return () => {
      window.cancelAnimationFrame(raf1);
      if (raf2) window.cancelAnimationFrame(raf2);
    };
  }, [pendingPrintAll, showAll, renderedCards.length]);

  const handlePrintAll = () => {
    if (showAll || filteredTables.length <= BATCH_SIZE) {
      window.print();
      return;
    }
    setShowAll(true);
    setPendingPrintAll(true);
  };

  const rangeStart = (safePage - 1) * BATCH_SIZE + 1;
  const rangeEnd = Math.min(filteredTables.length, safePage * BATCH_SIZE);

  return (
    <div className="space-y-4">
      {tables.length > BATCH_SIZE && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between print:hidden">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nomor / nama meja..."
                className="pl-9 h-9 text-xs"
              />
            </div>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {showAll
                ? `Menampilkan semua ${filteredTables.length} meja`
                : filteredTables.length === 0
                  ? "Tidak ada meja cocok"
                  : `Menampilkan ${rangeStart}–${rangeEnd} dari ${filteredTables.length} meja`}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {!showAll && totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="h-9 px-2.5"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span className="sr-only sm:not-sr-only sm:ml-1">Sebelumnya</span>
                </Button>
                <span className="px-2 text-xs font-bold text-slate-700 dark:text-slate-200 tabular-nums">
                  {safePage} / {totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={safePage >= totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  className="h-9 px-2.5"
                >
                  <span className="sr-only sm:not-sr-only sm:mr-1">Berikutnya</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAll((prev) => !prev)}
              className="h-9 text-xs"
            >
              <Layers className="mr-1.5 h-3.5 w-3.5" />
              {showAll
                ? `Kembali Mode Batch (${BATCH_SIZE}/hal)`
                : `Muat Semua (${filteredTables.length} Meja)`}
            </Button>

            {!showAll && (
              <Button
                type="button"
                size="sm"
                onClick={handlePrintAll}
                className="h-9 bg-[#1E88E5] hover:bg-[#1976D2] text-white text-xs"
              >
                <Printer className="mr-1.5 h-3.5 w-3.5" />
                Muat &amp; Cetak Semua ({filteredTables.length})
              </Button>
            )}
          </div>
        </div>
      )}

      {renderedCards.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
          Tidak ada meja aktif yang cocok dengan pencarian &quot;{searchQuery}&quot;.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-5">
          {renderedCards.map(({ table, svgMarkup }) => (
            <div
              key={table.id}
              className="break-inside-avoid flex flex-col items-center gap-2.5 [content-visibility:auto] [contain-intrinsic-size:330px_420px] print:[content-visibility:visible]"
            >
              <div className="w-full max-w-[330px]">
                <TableQrStandeeCard
                  outletName={outletName}
                  outletLogoUrl={outletLogoUrl}
                  outletThemeColor={outletThemeColor}
                  tableNo={table.tableNo}
                  qrSvg={svgMarkup}
                  compact={true}
                />
              </div>
              <div className="w-full max-w-[330px] print:hidden">
                <DownloadQrPngButton
                  outletName={outletName}
                  outletLogoUrl={outletLogoUrl}
                  outletThemeColor={outletThemeColor}
                  tableNo={table.tableNo}
                  qrToken={table.qrToken}
                  label={`Simpan PNG (${table.name})`}
                  variant="outline"
                  size="sm"
                  className="w-full h-10"
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
