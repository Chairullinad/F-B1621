import Link from "next/link";
import { headers } from "next/headers";
import { BatchTableQrPrintGrid } from "@/components/dashboard/batch-table-qr-print-grid";
import { DownloadAllQrPngButton } from "@/components/dashboard/download-all-qr-png-button";
import { DownloadQrPngButton } from "@/components/dashboard/download-qr-png-button";
import { PrintTriggerButton } from "@/components/dashboard/print-trigger-button";
import { Button } from "@/components/ui/button";
import {
  getOutletBrandSummaryForOwner,
  listTablesForOwner,
} from "@/server/master-data";

export default async function CetakQrMejaPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ table: tableFilter }, tables, outletBrand, hdrs] =
    await Promise.all([
      searchParams,
      listTablesForOwner(),
      getOutletBrandSummaryForOwner(),
      headers(),
    ]);

  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host") ?? "localhost:3000";
  const proto = hdrs.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  const baseUrl = `${proto}://${host}`;

  const activeTables = tables.filter((t) => {
    if (!t.is_active) return false;
    if (tableFilter) {
      return String(t.table_no) === tableFilter.trim();
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Cetak Standee QR Meja — {outletBrand.name} ({activeTables.length} Meja)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Klik <strong>Cetak / Simpan PDF</strong> di kanan, lalu pastikan opsi{" "}
            <strong>Background graphics / Grafis latar belakang</strong> dicentang pada dialog cetak agar warna{" "}
            <span className="font-mono font-semibold">{outletBrand.themeColor.toUpperCase()}</span> ikut tercetak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/meja">Kembali ke Daftar Meja</Link>
          </Button>
          {tableFilter ? (
            <Button asChild variant="secondary">
              <Link href="/dashboard/meja/cetak">Tampilkan Semua Meja Aktif</Link>
            </Button>
          ) : null}
          {activeTables.length === 1 && activeTables[0] ? (
            <DownloadQrPngButton
              outletName={outletBrand.name}
              outletLogoUrl={outletBrand.logoUrl}
              outletThemeColor={outletBrand.themeColor}
              tableNo={activeTables[0].table_no}
              qrToken={activeTables[0].qr_token}
              variant="default"
              className="bg-[#1E88E5] hover:bg-[#1976D2] text-white"
            />
          ) : activeTables.length > 1 ? (
            <DownloadAllQrPngButton
              outletName={outletBrand.name}
              outletLogoUrl={outletBrand.logoUrl}
              outletThemeColor={outletBrand.themeColor}
              tables={activeTables.map((t) => ({
                tableNo: t.table_no,
                qrToken: t.qr_token,
              }))}
            />
          ) : null}
          <PrintTriggerButton />
        </div>
      </div>

      <BatchTableQrPrintGrid
        tables={activeTables.map((t) => ({
          id: t.id,
          tableNo: t.table_no,
          name: t.name,
          qrToken: t.qr_token,
        }))}
        outletName={outletBrand.name}
        outletLogoUrl={outletBrand.logoUrl}
        outletThemeColor={outletBrand.themeColor}
        baseUrl={baseUrl}
      />
    </div>
  );
}
