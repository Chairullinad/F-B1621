import Link from "next/link";
import { headers } from "next/headers";
import { PrintTriggerButton } from "@/components/dashboard/print-trigger-button";
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
  const [{ table: tableFilter }, tables, { outlet }, hdrs] = await Promise.all([
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold">
            Cetak QR Meja — {outlet.name} ({activeTables.length} Meja)
          </h1>
          <p className="text-sm text-zinc-600">
            Gunakan tombol <strong>Cetak / Simpan PDF</strong> di kanan untuk
            mencetak stiker QR meja.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/meja">Kembali ke Daftar Meja</Link>
          </Button>
          {tableFilter ? (
            <Button asChild variant="secondary">
              <Link href="/dashboard/meja/cetak">Tampilkan Semua 100 Meja</Link>
            </Button>
          ) : null}
          <PrintTriggerButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3 print:gap-3">
        {activeTables.map((table) => {
          const qrUrl = `${baseUrl}/m/${table.qr_token}`;
          const svgMarkup = generateQrSvgString(qrUrl, 2);

          return (
            <div
              key={table.id}
              className="flex flex-col items-center justify-between rounded-xl border-2 border-zinc-900 bg-white p-4 text-center break-inside-avoid"
            >
              <div className="space-y-0.5">
                <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {outlet.name}
                </p>
                <h2 className="text-2xl font-extrabold text-zinc-950">
                  {table.name}
                </h2>
              </div>

              <div
                className="my-3 h-40 w-40"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />

              <div className="space-y-1">
                <p className="text-xs font-semibold text-zinc-900">
                  Scan untuk Pesan &amp; Bayar di Meja
                </p>
                <p className="font-mono text-[10px] text-zinc-500">
                  #{table.table_no} &bull; {table.qr_token.slice(0, 10)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
