"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatRupiah } from "@/lib/money";
import type {
  CompositionSlice,
  EsbDashboardAnalyticsData,
  HourlySalesPoint,
} from "@/server/dashboard-analytics";

interface EsbDashboardViewProps {
  initialData: EsbDashboardAnalyticsData;
}

export function EsbDashboardView({ initialData }: EsbDashboardViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [period, setPeriod] = useState<"today" | "month">(initialData.filter.period);
  const [selectedOutletId, setSelectedOutletId] = useState<string>(initialData.filter.outletId);
  const [stockPage, setStockPage] = useState<number>(1);
  const [activeHourlyTooltip, setActiveHourlyTooltip] = useState<HourlySalesPoint | null>(null);

  const data = initialData;

  const handlePeriodChange = (newPeriod: "today" | "month") => {
    setPeriod(newPeriod);
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("period", newPeriod);
      if (selectedOutletId) url.searchParams.set("outletId", selectedOutletId);
      router.push(url.pathname + url.search);
    });
  };

  const handleSearch = () => {
    startTransition(() => {
      const url = new URL(window.location.href);
      url.searchParams.set("period", period);
      if (selectedOutletId) url.searchParams.set("outletId", selectedOutletId);
      router.push(url.pathname + url.search);
    });
  };

  // Pagination untuk Stok Bahan Baku
  const itemsPerPage = 5;
  const totalStockItems = data.lowStockIngredients.length;
  const totalPages = Math.max(1, Math.ceil(totalStockItems / itemsPerPage));
  const displayedStock = data.lowStockIngredients.slice(
    (stockPage - 1) * itemsPerPage,
    stockPage * itemsPerPage
  );

  return (
    <div className="space-y-5 bg-[#F4F6F9] -m-4 md:-m-6 p-4 md:p-6 min-h-screen text-slate-800 font-sans">
      {/* 1. Header Banners / Announcement Carousel (Persis Screenshot 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Banner 1: Info QRIS */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 to-blue-600 p-5 md:p-6 text-white shadow-xs">
          <div className="relative z-10 max-w-[70%]">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Biaya QRIS berubah mulai 1 Oktober 2026
            </h2>
            <div className="mt-3 inline-block rounded-xl bg-amber-300/90 px-3.5 py-1.5 text-xs md:text-sm font-semibold text-slate-900 shadow-xs">
              Transaksi hingga Rp100.000: Rp500/transaksi.
              <br />
              Transaksi lebih dari Rp100.000: MDR 0,7%
            </div>
          </div>
          {/* Ilustrasi Megaphone */}
          <div className="absolute right-2 -bottom-2 md:right-4 md:bottom-0 text-7xl md:text-8xl select-none opacity-90 drop-shadow-md">
            📢
          </div>
        </div>

        {/* Banner 2: Aktivasi Order & Tips */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 p-5 md:p-6 text-white shadow-xs">
          <div className="relative z-10 max-w-[70%]">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight">
              Mulai aktivasi tanpa biaya!
            </h2>
            <p className="mt-2 text-xs md:text-sm text-blue-100">
              Integrasi QR Meja, POS Kasir &amp; Laporan Keuangan 5 Tab langsung aktif.
            </p>
            <div className="mt-4">
              <Link href="/kasir">
                <button
                  type="button"
                  className="rounded-lg bg-[#F58220] px-4 py-2 text-xs md:text-sm font-bold text-white shadow-sm transition hover:bg-[#e07519]"
                >
                  Buka Kasir 1621F&B
                </button>
              </Link>
            </div>
          </div>
          {/* Ilustrasi Phone */}
          <div className="absolute right-4 bottom-2 text-6xl md:text-7xl select-none opacity-85">
            📱
          </div>
        </div>
      </div>

      {/* 2. Filter Bar Dashboard (Persis Screenshot 2) */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 md:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Filter Dashboard
          </h3>
          {/* Toggle Hari / Bulan */}
          <div className="flex items-center rounded-lg border border-sky-300 bg-sky-50/50 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => handlePeriodChange("today")}
              className={`rounded-md px-4 py-1.5 transition ${
                period === "today"
                  ? "bg-[#0284C7] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Hari
            </button>
            <button
              type="button"
              onClick={() => handlePeriodChange("month")}
              className={`rounded-md px-4 py-1.5 transition ${
                period === "month"
                  ? "bg-[#0284C7] text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Bulan
            </button>
          </div>
        </div>

        {/* Form Filter Dropdown 3 Kolom + Tombol Cari Oranye */}
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-2xs font-medium text-slate-400 mb-1">
              Perusahaan
            </label>
            <input
              type="text"
              readOnly
              value={data.filter.company}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 cursor-default"
            />
          </div>

          <div>
            <label className="block text-2xs font-medium text-slate-400 mb-1">
              Brand
            </label>
            <input
              type="text"
              readOnly
              value={data.filter.brand}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 cursor-default"
            />
          </div>

          <div>
            <label className="block text-2xs font-medium text-slate-400 mb-1">
              Cabang
            </label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 focus:border-[#0284C7] focus:outline-hidden"
            >
              {data.availableOutlets.map((out) => (
                <option key={out.id} value={out.id}>
                  {out.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <button
              type="button"
              onClick={handleSearch}
              disabled={isPending}
              className="w-full rounded-lg bg-[#F58220] py-2 px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[#e07519] active:scale-[0.98]"
            >
              {isPending ? "Memuat..." : "Cari"}
            </button>
          </div>
        </div>
      </div>

      {/* 3. Sub-Banner BARU: Menu Terlaris + 6 KPI Grid (Persis Screenshot 2) */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Kotak Toska: Rekomendasi Menu */}
        <div className="rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-4 flex flex-col justify-between">
          <div>
            <span className="inline-block rounded-full bg-[#0284C7] px-2.5 py-0.5 text-2xs font-bold text-white uppercase">
              BARU
            </span>
            <h4 className="mt-2 text-xs font-bold text-slate-800">
              Ini 5 menu terlaris di restoran Anda!
            </h4>
            <p className="mt-1 text-2xs text-slate-500 leading-relaxed">
              Cek dan optimalkan stok menu sesuai selera pelanggan.
            </p>
          </div>
          <div className="mt-4">
            <a
              href="#tabel-menu-terlaris"
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-lg bg-[#00A896] py-2 text-xs font-bold text-white shadow-xs hover:bg-[#009282] transition"
            >
              <span>✦</span> Cek Sekarang
            </a>
          </div>
        </div>

        {/* 6 Kartu Metrik KPI (3 Kolom x 2 Baris pada LG) */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* 1. Penjualan Bersih */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-2xs font-medium text-slate-400">
                Penjualan Bersih
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                  data.kpis.netSalesTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.netSalesTrendPct >= 0 ? "+" : ""}
                {data.kpis.netSalesTrendPct}%
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {formatRupiah(data.kpis.netSales)}
            </div>
          </div>

          {/* 2. Total Bill */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-2xs font-medium text-slate-400">
                Total Bill
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                  data.kpis.totalBillTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.totalBillTrendPct >= 0 ? "+" : ""}
                {data.kpis.totalBillTrendPct}%
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {data.kpis.totalBill}
            </div>
          </div>

          {/* 3. Ukuran Bill (Basket Size) */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-2xs font-medium text-slate-400">
                Ukuran Bill
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                  data.kpis.basketSizeTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.basketSizeTrendPct >= 0 ? "+" : ""}
                {data.kpis.basketSizeTrendPct}%
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {formatRupiah(data.kpis.basketSize)}
            </div>
          </div>

          {/* 4. Total Pax */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-2xs font-medium text-slate-400">
                Total Pax
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                  data.kpis.totalPaxTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.totalPaxTrendPct >= 0 ? "+" : ""}
                {data.kpis.totalPaxTrendPct}%
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {data.kpis.totalPax}
            </div>
          </div>

          {/* 5. Pembelanjaan Per Pax */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-2xs font-medium text-slate-400">
                Pembelanjaan Per Pax
              </span>
              <span
                className={`rounded px-1.5 py-0.5 text-2xs font-bold ${
                  data.kpis.spendPerPaxTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.spendPerPaxTrendPct >= 0 ? "+" : ""}
                {data.kpis.spendPerPaxTrendPct}%
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {formatRupiah(data.kpis.spendPerPax)}
            </div>
          </div>

          {/* 6. Penjualan Item Tertunda */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-3.5 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-2xs font-medium text-slate-400">
                Penjualan Item Tertunda
              </span>
              <span className="rounded px-1.5 py-0.5 text-2xs font-bold bg-slate-100 text-slate-500">
                0%
              </span>
            </div>
            <div className="mt-2 text-lg sm:text-xl font-bold text-slate-800 tracking-tight">
              {formatRupiah(data.kpis.pendingSales)}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Statistik Penjualan — Dual-Axis Hourly Line Chart (Persis Screenshot 3) */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 md:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Statistik Penjualan
          </h3>
          {/* Legend */}
          <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#0284C7]" />
              <span>Total Penjualan Bersih</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-3 w-3 rounded-xs bg-[#EE607D]" />
              <span>Total Bill</span>
            </div>
          </div>
        </div>

        {/* SVG Dual-Axis Chart Canvas */}
        <div className="relative w-full overflow-x-auto pt-2 pb-4">
          <HourlyDualAxisChart
            points={data.hourlyChart}
            onHoverPoint={setActiveHourlyTooltip}
          />
          {/* Tooltip Hover Bubble */}
          {activeHourlyTooltip && (
            <div className="absolute top-2 right-4 rounded-lg bg-slate-900/90 px-3 py-2 text-xs text-white shadow-lg pointer-events-none">
              <div className="font-bold text-sky-400">
                Jam {activeHourlyTooltip.hour} WIB
              </div>
              <div className="text-slate-200">
                Penjualan: {formatRupiah(activeHourlyTooltip.sales)}
              </div>
              <div className="text-slate-300">
                Bill: {activeHourlyTooltip.bills} transaksi
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 5. Tabel Stok Bahan Baku Kritis (Persis Screenshot 4) */}
      <div className="rounded-xl border border-slate-200/90 bg-white p-4 md:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">
            Stok Bahan Baku
          </h3>
          {/* Badge Bel Oranye Peringatan */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-1.5 text-xs font-semibold text-amber-900">
            <span className="text-base">🔔</span>
            <span>Di bawah batas aman stok:</span>
            <span className="rounded-md bg-amber-200/80 px-2 py-0.5 font-bold text-amber-950">
              {data.criticalStockCount} item
            </span>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto rounded-lg border border-slate-100">
          <table className="w-full text-left text-xs">
            <thead className="bg-sky-50/50 text-slate-600 font-semibold border-b border-slate-200/70">
              <tr>
                <th className="py-2.5 px-3 w-12">No.</th>
                <th className="py-2.5 px-3">
                  <div className="flex items-center gap-1 cursor-pointer">
                    <span>Nama Bahan Baku</span>
                    <span className="text-2xs text-slate-400">↕</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer">
                    <span>Batas Aman Stok</span>
                    <span className="text-2xs text-slate-400">↕</span>
                  </div>
                </th>
                <th className="py-2.5 px-3 text-right">
                  <div className="flex items-center justify-end gap-1 cursor-pointer">
                    <span>Stok Sekarang</span>
                    <span className="text-2xs text-slate-400">↕</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedStock.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    Semua stok bahan baku saat ini berada dalam batas aman.
                  </td>
                </tr>
              ) : (
                displayedStock.map((item, idx) => {
                  const rowNum = (stockPage - 1) * itemsPerPage + idx + 1;
                  const isNegative = item.currentStock < 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-2.5 px-3 text-slate-500 font-medium">
                        {rowNum}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">
                        {item.name}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-slate-600">
                        {item.minStock.toLocaleString("id-ID")} {item.unit}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-bold ${
                          isNegative
                            ? "text-rose-600"
                            : item.currentStock <= item.minStock
                            ? "text-amber-600"
                            : "text-slate-800"
                        }`}
                      >
                        {item.currentStock.toLocaleString("id-ID")} {item.unit}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-2xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={stockPage <= 1}
              onClick={() => setStockPage((p) => Math.max(1, p - 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              &lt;
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setStockPage(p)}
                  className={`rounded px-2.5 py-1 font-semibold ${
                    stockPage === p
                      ? "bg-[#0284C7] text-white"
                      : "border border-slate-200 hover:bg-slate-100"
                  }`}
                >
                  {p}
                </button>
              )
            )}
            {totalPages > 5 && <span className="px-1 text-slate-400">...</span>}
            <button
              type="button"
              disabled={stockPage >= totalPages}
              onClick={() => setStockPage((p) => Math.min(totalPages, p + 1))}
              className="rounded border border-slate-200 px-2 py-1 disabled:opacity-40"
            >
              &gt;
            </button>
          </div>
          <div>
            Menampilkan {displayedStock.length} dari {totalStockItems} data
          </div>
        </div>
      </div>

      {/* 6. Kontrol Fraud (Persis Screenshot 4) */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">
          Kontrol Fraud
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Card 1: Other Cost */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs border-l-4 border-l-amber-500 flex items-center justify-between">
            <div>
              <div className="text-2xs font-medium text-slate-400">
                Transaksi Other Cost
              </div>
              <div className="mt-1 text-lg font-bold text-slate-800">
                {formatRupiah(data.fraudControl.otherCost)}
              </div>
            </div>
            <Link
              href="/dashboard/keuangan"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0284C7] text-white hover:bg-[#0369a1] transition shadow-xs"
            >
              &gt;
            </Link>
          </div>

          {/* Card 2: Komplimen / Diskon */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs border-l-4 border-l-amber-500 flex items-center justify-between">
            <div>
              <div className="text-2xs font-medium text-slate-400">
                Transaksi Komplimen &amp; Diskon
              </div>
              <div className="mt-1 text-lg font-bold text-slate-800">
                {formatRupiah(data.fraudControl.komplimen)}
              </div>
            </div>
            <Link
              href="/dashboard/transaksi"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0284C7] text-white hover:bg-[#0369a1] transition shadow-xs"
            >
              &gt;
            </Link>
          </div>

          {/* Card 3: Pembatalan / Void */}
          <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs border-l-4 border-l-amber-500 flex items-center justify-between">
            <div>
              <div className="text-2xs font-medium text-slate-400">
                Pembatalan (Void)
              </div>
              <div className="mt-1 text-lg font-bold text-slate-800">
                {formatRupiah(data.fraudControl.voidAmount)}
              </div>
            </div>
            <Link
              href="/dashboard/transaksi"
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#0284C7] text-white hover:bg-[#0369a1] transition shadow-xs"
            >
              &gt;
            </Link>
          </div>
        </div>
      </div>

      {/* 7. Komposisi — 3 Diagram Donut/Pie (Persis Screenshot 4 & 5) */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">
          Komposisi
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Komposisi 1: Mode Penjualan */}
          <CompositionCard
            title="Penjualan Dari Mode Penjualan"
            typeColumnName="Kategori Mode"
            slices={data.compositions.mode}
          />

          {/* Komposisi 2: Metode Pembayaran */}
          <CompositionCard
            title="Penjualan Dari Metode Pembayaran"
            typeColumnName="Tipe Metode"
            slices={data.compositions.payment}
          />

          {/* Komposisi 3: Kategori */}
          <CompositionCard
            title="Penjualan Dari Kategori"
            typeColumnName="Kategori"
            slices={data.compositions.category}
          />
        </div>
      </div>

      {/* 8. Bottom Row: Menu Terlaris & Cabang Terbaik (Persis Screenshot 5) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" id="tabel-menu-terlaris">
        {/* Tabel Menu Terlaris */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 tracking-tight">
              Menu Terlaris
            </h4>
            <span className="text-2xs text-slate-400">5 Teratas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th className="py-2 px-3">Nama Menu</th>
                  <th className="py-2 px-3 text-right">Nilai (Porsi)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.topProducts.map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {p.name}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-700">
                      {formatRupiah(p.totalSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabel Cabang Terbaik */}
        <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-xs font-bold text-slate-800 tracking-tight">
              Cabang Dengan Penjualan Terbaik
            </h4>
            <span className="text-2xs text-slate-400">5 Teratas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 font-semibold">
                <tr>
                  <th className="py-2 px-3">Nama Cabang</th>
                  <th className="py-2 px-3 text-right">Penjualan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {data.bestOutlets.map((b) => (
                  <tr key={b.name} className="hover:bg-slate-50/60">
                    <td className="py-2 px-3 font-medium text-slate-800">
                      {b.name}
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-700">
                      {formatRupiah(b.totalSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// HELPER KOMPONEN: Hourly Dual Axis Chart (SVG)
// ============================================================================

function HourlyDualAxisChart({
  points,
  onHoverPoint,
}: {
  points: HourlySalesPoint[];
  onHoverPoint: (pt: HourlySalesPoint | null) => void;
}) {
  const maxSales = Math.max(1000000, ...points.map((p) => p.sales));
  const maxBills = Math.max(10, ...points.map((p) => p.bills));

  const chartWidth = 900;
  const chartHeight = 240;
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 20;
  const paddingBottom = 40;

  const innerWidth = chartWidth - paddingLeft - paddingRight;
  const innerHeight = chartHeight - paddingTop - paddingBottom;

  const stepX = innerWidth / Math.max(1, points.length - 1);

  // Koordinat Line Sales (Biru)
  const salesCoords = points.map((p, i) => {
    const x = paddingLeft + i * stepX;
    const y = paddingTop + innerHeight - (p.sales / maxSales) * innerHeight;
    return { x, y, point: p };
  });

  // Koordinat Line Bills (Coral/Merah)
  const billsCoords = points.map((p, i) => {
    const x = paddingLeft + i * stepX;
    const y = paddingTop + innerHeight - (p.bills / maxBills) * innerHeight;
    return { x, y, point: p };
  });

  const salesPathD = salesCoords.reduce(
    (acc, c, i) => `${acc} ${i === 0 ? "M" : "L"} ${c.x} ${c.y}`,
    ""
  );

  const billsPathD = billsCoords.reduce(
    (acc, c, i) => `${acc} ${i === 0 ? "M" : "L"} ${c.x} ${c.y}`,
    ""
  );

  // Horizontal Grid Lines (5 step)
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <svg
      viewBox={`0 0 ${chartWidth} ${chartHeight}`}
      className="w-full h-auto select-none overflow-visible"
    >
      {/* Grid Lines */}
      {gridSteps.map((step) => {
        const y = paddingTop + innerHeight - step * innerHeight;
        const salesVal = Math.round(step * maxSales);
        const billsVal = Math.round(step * maxBills);
        return (
          <g key={step}>
            <line
              x1={paddingLeft}
              y1={y}
              x2={chartWidth - paddingRight}
              y2={y}
              stroke="#E2E8F0"
              strokeDasharray="2 2"
            />
            {/* Left Y Axis Label (Rp) */}
            <text
              x={paddingLeft - 8}
              y={y + 4}
              textAnchor="end"
              className="text-[10px] fill-slate-400 font-medium"
            >
              {salesVal === 0 ? "0,00" : (salesVal / 1000).toLocaleString("id-ID") + " rb"}
            </text>
            {/* Right Y Axis Label (Bills) */}
            <text
              x={chartWidth - paddingRight + 8}
              y={y + 4}
              textAnchor="start"
              className="text-[10px] fill-slate-400 font-medium"
            >
              {billsVal}
            </text>
          </g>
        );
      })}

      {/* X Axis Labels */}
      {points.map((p, i) => {
        const x = paddingLeft + i * stepX;
        return (
          <text
            key={p.hour}
            x={x}
            y={chartHeight - 12}
            textAnchor="middle"
            className="text-[10px] fill-slate-400 font-medium"
          >
            {p.hour}
          </text>
        );
      })}

      {/* Line 1: Penjualan Bersih (Biru) */}
      <path
        d={salesPathD}
        fill="none"
        stroke="#0284C7"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Line 2: Total Bill (Merah/Coral) */}
      <path
        d={billsPathD}
        fill="none"
        stroke="#EE607D"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Dots and Hover Area */}
      {salesCoords.map((c, i) => (
        <g key={i}>
          {/* Blue Point */}
          <circle
            cx={c.x}
            cy={c.y}
            r="4"
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth="2"
            className="cursor-pointer transition-transform hover:scale-125"
            onMouseEnter={() => onHoverPoint(c.point)}
            onMouseLeave={() => onHoverPoint(null)}
          />
          {/* Red Point */}
          <circle
            cx={billsCoords[i]?.x ?? c.x}
            cy={billsCoords[i]?.y ?? c.y}
            r="4"
            fill="#EE607D"
            stroke="#FFFFFF"
            strokeWidth="2"
            className="cursor-pointer transition-transform hover:scale-125"
            onMouseEnter={() => onHoverPoint(c.point)}
            onMouseLeave={() => onHoverPoint(null)}
          />
        </g>
      ))}
    </svg>
  );
}

// ============================================================================
// HELPER KOMPONEN: Composition Donut/Pie Card
// ============================================================================

function CompositionCard({
  title,
  typeColumnName,
  slices,
}: {
  title: string;
  typeColumnName: string;
  slices: CompositionSlice[];
}) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
      <div>
        <h4 className="text-center text-xs font-bold text-slate-700 mb-4">
          {title}
        </h4>

        {/* SVG Pie Chart */}
        <div className="flex justify-center my-2">
          <SimpleSvgPie slices={slices} size={150} />
        </div>
      </div>

      {/* Detail Table */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <table className="w-full text-left text-2xs">
          <thead className="text-slate-400 font-semibold border-b border-slate-100">
            <tr>
              <th className="pb-1.5">{typeColumnName}</th>
              <th className="pb-1.5 text-right">Porsi</th>
              <th className="pb-1.5 text-right">Persentase</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-slate-600">
            {slices.map((s) => (
              <tr key={s.label}>
                <td className="py-1.5 flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-xs shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate max-w-[110px] font-medium text-slate-700">
                    {s.label}
                  </span>
                </td>
                <td className="py-1.5 text-right font-medium">
                  {formatRupiah(s.value)}
                </td>
                <td className="py-1.5 text-right font-semibold text-slate-800">
                  {s.percentage}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SimpleSvgPie({
  slices,
  size,
}: {
  slices: CompositionSlice[];
  size: number;
}) {
  const center = size / 2;
  const radius = center - 8;

  let cumulativeAngle = 0;

  const paths = slices.map((slice) => {
    const angle = (slice.percentage / 100) * 360;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    if (slice.percentage >= 99.9) {
      return (
        <circle
          key={slice.label}
          cx={center}
          cy={center}
          r={radius}
          fill={slice.color}
        />
      );
    }

    if (slice.percentage <= 0) return null;

    const startRad = (startAngle - 90) * (Math.PI / 180);
    const endRad = (endAngle - 90) * (Math.PI / 180);

    const x1 = center + radius * Math.cos(startRad);
    const y1 = center + radius * Math.sin(startRad);
    const x2 = center + radius * Math.cos(endRad);
    const y2 = center + radius * Math.sin(endRad);

    const largeArcFlag = angle > 180 ? 1 : 0;

    const pathData = `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;

    return <path key={slice.label} d={pathData} fill={slice.color} />;
  });

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {paths}
    </svg>
  );
}
