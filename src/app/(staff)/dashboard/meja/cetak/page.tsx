import Image from "next/image";
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
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            Cetak Standee QR Meja — {outlet.name} ({activeTables.length} Meja)
          </h1>
          <p className="text-sm text-slate-600">
            Gunakan tombol <strong>Cetak / Simpan PDF</strong> di kanan untuk
            mencetak stiker atau akrilik QR meja resmi berlogo <strong>1621 Group</strong>.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline">
            <Link href="/dashboard/meja">Kembali ke Daftar Meja</Link>
          </Button>
          {tableFilter ? (
            <Button asChild variant="secondary">
              <Link href="/dashboard/meja/cetak">Tampilkan Semua Meja Aktif</Link>
            </Button>
          ) : null}
          <PrintTriggerButton />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 print:grid-cols-3 print:gap-4">
        {activeTables.map((table) => {
          const qrUrl = `${baseUrl}/m/${table.qr_token}`;
          const svgMarkup = generateQrSvgString(qrUrl, 2);

          return (
            <div
              key={table.id}
              className="flex flex-col items-center justify-between rounded-2xl border-2 border-[#1B5E86] bg-white p-4 text-center shadow-xs break-inside-avoid"
            >
              {/* Header Brand 1621 Group + Nama Cabang */}
              <div className="flex w-full flex-col items-center border-b border-slate-100 pb-2.5">
                <Image
                  src="/logo-1621group.png"
                  alt="1621 Group"
                  width={136}
                  height={38}
                  className="h-8 w-auto object-contain"
                />
                <span className="mt-1 rounded-full bg-[#EBF5FF] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#1B5E86]">
                  {outlet.name}
                </span>
              </div>

              {/* Nomor Meja */}
              <div className="my-2.5">
                <h2 className="inline-block rounded-lg bg-[#1B5E86] px-4 py-1 text-lg font-extrabold tracking-wide text-white uppercase">
                  {table.name}
                </h2>
              </div>

              {/* QR Code Murni Presisi Tinggi */}
              <div
                className="h-40 w-40 rounded-xl border-2 border-slate-200 bg-white p-2"
                dangerouslySetInnerHTML={{ __html: svgMarkup }}
              />

              {/* Footer Panduan 3 Langkah & Identitas */}
              <div className="mt-3 w-full space-y-1 border-t border-slate-100 pt-2.5">
                <p className="text-[11px] font-bold tracking-wide text-slate-900">
                  SCAN UNTUK PESAN DI MEJA
                </p>
                <p className="text-[10px] font-medium text-slate-600">
                  1. Scan QR &bull; 2. Pilih Menu &bull; 3. Bayar QRIS/Kasir
                </p>
                <p className="font-mono text-[9px] text-slate-400">
                  1621 GROUP POS &bull; #{table.table_no} &bull; {table.qr_token.slice(0, 8)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
