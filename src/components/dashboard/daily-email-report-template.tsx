"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Calendar, Download, FileSpreadsheet } from "lucide-react";
import { formatRupiah } from "@/lib/money";
import type { DailyHoldingReportPreview } from "@/server/holding-reports";

export function DailyEmailReportTemplate({
  preview,
  dateQueryBasePath = "/dashboard/keuangan",
}: {
  preview: DailyHoldingReportPreview;
  dateQueryBasePath?: string;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = React.useState(preview.dateWib);

  React.useEffect(() => {
    setSelectedDate(preview.dateWib);
  }, [preview.dateWib]);

  function handleDateChange(nextDate: string) {
    setSelectedDate(nextDate);
    if (/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
      const separator = dateQueryBasePath.includes("?") ? "&" : "?";
      router.push(
        `${dateQueryBasePath}${separator}date=${encodeURIComponent(nextDate)}`
      );
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900 dark:text-slate-100">
            <FileSpreadsheet className="h-5 w-5 text-[#1E88E5]" />
            <span>
              Template Report Keuangan &amp; Akuntansi Harian per Outlet (
              {preview.dateWib} WIB)
            </span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Template laporan lengkap yang dikirim otomatis ke email Owner dalam
            arsip <code>.zip</code> sebagai backup harian setiap outlet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 h-10">
            <Calendar className="h-4 w-4 text-slate-400" />
            <label
              htmlFor="daily-template-date"
              className="text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              Tanggal:
            </label>
            <input
              id="daily-template-date"
              type="date"
              value={selectedDate}
              onChange={(e) => handleDateChange(e.target.value)}
              className="bg-transparent text-xs font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            />
          </div>

          <a
            href={`/api/reports/daily-zip?date=${encodeURIComponent(
              selectedDate
            )}`}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 px-3.5 text-xs font-semibold text-slate-700 dark:text-slate-200 transition"
          >
            <Download className="h-3.5 w-3.5 text-[#1E88E5]" />
            <span>Download .zip</span>
          </a>
        </div>
      </div>

      {/* 4 KPI Konsolidasi Harian */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            Penjualan Bersih Harian
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatRupiah(preview.totals.netSales)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            {preview.totals.paidOrdersCount} bill lunas &bull; QRIS{" "}
            {formatRupiah(preview.totals.qrisSales)} / Tunai{" "}
            {formatRupiah(preview.totals.cashSales)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            Laba Bersih Harian
          </div>
          <div
            className={`mt-1 text-xl font-bold ${
              preview.totals.netProfit >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            {formatRupiah(preview.totals.netProfit)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            HPP {formatRupiah(preview.totals.cogsAmount)} &bull; Beban{" "}
            {formatRupiah(preview.totals.operatingExpenses)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            Arus Kas Bersih Harian
          </div>
          <div className="mt-1 text-xl font-bold text-[#1E88E5] dark:text-sky-400">
            {formatRupiah(preview.totals.netCashFlow)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Masuk {formatRupiah(preview.totals.cashInflow)} &bull; Keluar{" "}
            {formatRupiah(preview.totals.cashOutflow)}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 p-3.5">
          <div className="text-[11px] font-semibold uppercase text-slate-500">
            Posisi Stok, Pajak &amp; Audit
          </div>
          <div className="mt-1 text-xl font-bold text-slate-900 dark:text-slate-100">
            {formatRupiah(preview.totals.inventoryAssetValue)}
          </div>
          <div className="mt-0.5 text-[11px] text-slate-500">
            Pajak {formatRupiah(preview.totals.totalTax)} &bull;{" "}
            {preview.totals.journalCount} jurnal &bull;{" "}
            {preview.totals.auditLogsCount} audit
          </div>
        </div>
      </div>

      {/* Tabel Lengkap Per Outlet */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300">
              <th className="px-3 py-3 font-bold">Outlet</th>
              <th className="px-3 py-3 text-right font-bold">Bill</th>
              <th className="px-3 py-3 text-right font-bold">Kotor</th>
              <th className="px-3 py-3 text-right font-bold">
                Diskon / Refund
              </th>
              <th className="px-3 py-3 text-right font-bold">Bersih</th>
              <th className="px-3 py-3 text-right font-bold">HPP &amp; Beban</th>
              <th className="px-3 py-3 text-right font-bold">Laba Bersih</th>
              <th className="px-3 py-3 text-right font-bold">Arus Kas</th>
              <th className="px-3 py-3 text-right font-bold">Pajak + Svc</th>
              <th className="px-3 py-3 text-right font-bold">Nilai Stok</th>
              <th className="px-3 py-3 text-right font-bold">
                Jurnal / Audit
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
            {preview.outlets.map((row) => (
              <tr
                key={row.outletId}
                className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50"
              >
                <td className="px-3 py-3 font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                  <div>{row.outletName}</div>
                  <div className="text-[10px] font-normal text-slate-500">
                    QRIS {formatRupiah(row.qrisSales)} &bull; Tunai{" "}
                    {formatRupiah(row.cashSales)}
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <span className="font-bold">{row.paidOrdersCount}</span>
                  {row.cancelledOrdersCount > 0 && (
                    <div className="text-[10px] text-rose-500">
                      {row.cancelledOrdersCount} batal
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatRupiah(row.grossSales)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-rose-600 dark:text-rose-400">
                  {formatRupiah(row.totalDiscount + row.totalRefund)}
                </td>
                <td className="px-3 py-3 text-right font-bold tabular-nums">
                  {formatRupiah(row.netSales)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">
                  {formatRupiah(row.cogsAmount + row.operatingExpenses)}
                </td>
                <td
                  className={`px-3 py-3 text-right font-bold tabular-nums ${
                    row.netProfit >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {formatRupiah(row.netProfit)}
                </td>
                <td className="px-3 py-3 text-right font-semibold tabular-nums text-[#1E88E5] dark:text-sky-400">
                  {formatRupiah(row.netCashFlow)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatRupiah(row.totalTax + row.totalService)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  <div>{formatRupiah(row.inventoryAssetValue)}</div>
                  {row.lowStockCount > 0 && (
                    <div className="text-[10px] text-amber-600">
                      {row.lowStockCount} menipis
                    </div>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {row.journalCount} / {row.auditLogsCount}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
