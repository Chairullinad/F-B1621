import Link from "next/link";
import { headers } from "next/headers";
import { DownloadAllQrPngButton } from "@/components/dashboard/download-all-qr-png-button";
import { DownloadQrPngButton } from "@/components/dashboard/download-qr-png-button";
import { PrintTriggerButton } from "@/components/dashboard/print-trigger-button";
import { TableQrStandeeCard } from "@/components/dashboard/table-qr-standee-card";
import { Button } from "@/components/ui/button";
import { generateQrSvgString } from "@/lib/qrcode";
import {
  getOutletAndNotificationSettings,
  listTablesForOwner,
} from "@/server/master-data";

export default async function CetakQrMejaPage({
  searchParams,
}: {
  searchParams: Promise<{ table?: string }>;
}) {
  const [{ table: tableFilter }, tables, { outletView }, hdrs] =
    await Promise.all([
      searchParams,
      listTablesForOwner(),
      getOutletAndNotificationSettings(),
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
            Cetak Standee QR Meja — {outletView.name} ({activeTables.length} Meja)
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Klik <strong>Cetak / Simpan PDF</strong> di kanan, lalu pastikan opsi{" "}
            <strong>Background graphics / Grafis latar belakang</strong> dicentang pada dialog cetak agar warna{" "}
            <span className="font-mono font-semibold">{outletView.themeColor.toUpperCase()}</span> ikut tercetak.
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
              outletName={outletView.name}
              outletLogoUrl={outletView.logoUrl}
              outletThemeColor={outletView.themeColor}
              tableNo={activeTables[0].table_no}
              qrToken={activeTables[0].qr_token}
              variant="default"
              className="bg-[#1E88E5] hover:bg-[#1976D2] text-white"
            />
          ) : activeTables.length > 1 ? (
            <DownloadAllQrPngButton
              outletName={outletView.name}
              outletLogoUrl={outletView.logoUrl}
              outletThemeColor={outletView.themeColor}
              tables={activeTables.map((t) => ({
                tableNo: t.table_no,
                qrToken: t.qr_token,
              }))}
            />
          ) : null}
          <PrintTriggerButton />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-2 print:gap-5">
        {activeTables.map((table) => {
          const qrUrl = `${baseUrl}/m/${table.qr_token}`;
          const svgMarkup = generateQrSvgString(qrUrl, 2);

          return (
            <div
              key={table.id}
              className="break-inside-avoid flex flex-col items-center gap-2.5 [content-visibility:auto] [contain-intrinsic-size:330px_420px] print:[content-visibility:visible]"
            >
              <div className="w-full max-w-[330px]">
                <TableQrStandeeCard
                  outletName={outletView.name}
                  outletLogoUrl={outletView.logoUrl}
                  outletThemeColor={outletView.themeColor}
                  tableNo={table.table_no}
                  qrSvg={svgMarkup}
                  compact={true}
                />
              </div>
              <div className="w-full max-w-[330px] print:hidden">
                <DownloadQrPngButton
                  outletName={outletView.name}
                  outletLogoUrl={outletView.logoUrl}
                  outletThemeColor={outletView.themeColor}
                  tableNo={table.table_no}
                  qrToken={table.qr_token}
                  label={`Simpan PNG (${table.name})`}
                  variant="outline"
                  size="sm"
                  className="w-full h-10"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
