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
  const [showTipsModal, setShowTipsModal] = useState<boolean>(false);

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
    <div className="space-y-6 bg-[#F4F6F9] -m-4 md:-m-6 p-4 md:p-6 min-h-screen text-slate-800 font-sans">
      {/* 1. Filter Bar Dashboard (Kini langsung di bagian atas tanpa banner promo) */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">
              Filter Dashboard
            </h2>
            <p className="text-xs text-slate-500">
              Menampilkan data operasional untuk outlet:{" "}
              <strong className="text-sky-700">{data.staff.outletName}</strong>
            </p>
          </div>

          {/* Toggle Hari / Bulan */}
          <div className="flex items-center rounded-xl border border-sky-300 bg-sky-50/50 p-1 text-xs sm:text-sm font-semibold">
            <button
              type="button"
              onClick={() => handlePeriodChange("today")}
              className={`rounded-lg px-4 py-1.5 transition cursor-pointer ${
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
              className={`rounded-lg px-4 py-1.5 transition cursor-pointer ${
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
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Perusahaan
            </label>
            <input
              type="text"
              readOnly
              value={data.filter.company}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 cursor-default"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Brand
            </label>
            <input
              type="text"
              readOnly
              value={data.filter.brand}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm font-medium text-slate-700 cursor-default"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1.5">
              Cabang / Outlet
            </label>
            <select
              value={selectedOutletId}
              onChange={(e) => setSelectedOutletId(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-800 shadow-2xs focus:border-[#0284C7] focus:ring-2 focus:ring-sky-100 focus:outline-hidden cursor-pointer"
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
              className="w-full rounded-xl bg-[#F58220] py-2.5 px-5 text-sm font-bold text-white shadow-xs transition hover:bg-[#e07519] active:scale-[0.98] cursor-pointer"
            >
              {isPending ? "Memuat Data..." : "Terapkan Filter"}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Sub-Banner Rekomendasi Menu + 6 KPI Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Kotak Toska: Rekomendasi Menu */}
        <div className="rounded-2xl border border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 p-5 flex flex-col justify-between shadow-xs">
          <div>
            <span className="inline-block rounded-full bg-[#0284C7] px-3 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
              INFORMASI
            </span>
            <h4 className="mt-3 text-sm sm:text-base font-bold text-slate-900 leading-snug">
              5 Menu Terlaris di {data.staff.outletName}!
            </h4>
            <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
              Cek dan optimalkan stok bahan baku untuk menjaga ketersediaan menu favorit pelanggan.
            </p>
          </div>
          <div className="mt-5">
            <button
              type="button"
              onClick={() => setShowTipsModal(true)}
              className="inline-flex items-center justify-center gap-1.5 w-full rounded-xl bg-[#00A896] hover:bg-[#009282] active:scale-[0.98] py-2.5 text-xs sm:text-sm font-bold text-white shadow-xs transition cursor-pointer"
            >
              <span>✦</span> Lihat 5 Menu Terlaris (Tips Bisnis)
            </button>
          </div>
        </div>

        {/* 6 Kartu Metrik KPI (3 Kolom x 2 Baris pada LG) */}
        <div className="lg:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          {/* 1. Penjualan Bersih */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Penjualan Bersih
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  data.kpis.netSalesTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.netSalesTrendPct >= 0 ? "+" : ""}
                {data.kpis.netSalesTrendPct}%
              </span>
            </div>
            <div className="mt-3 text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(data.kpis.netSales)}
            </div>
          </div>

          {/* 2. Total Bill */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Total Bill
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  data.kpis.totalBillTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.totalBillTrendPct >= 0 ? "+" : ""}
                {data.kpis.totalBillTrendPct}%
              </span>
            </div>
            <div className="mt-3 text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {data.kpis.totalBill}
            </div>
          </div>

          {/* 3. Ukuran Bill (Basket Size) */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Ukuran Bill
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  data.kpis.basketSizeTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.basketSizeTrendPct >= 0 ? "+" : ""}
                {data.kpis.basketSizeTrendPct}%
              </span>
            </div>
            <div className="mt-3 text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(data.kpis.basketSize)}
            </div>
          </div>

          {/* 4. Total Pax */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Total Pax
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  data.kpis.totalPaxTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.totalPaxTrendPct >= 0 ? "+" : ""}
                {data.kpis.totalPaxTrendPct}%
              </span>
            </div>
            <div className="mt-3 text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {data.kpis.totalPax}
            </div>
          </div>

          {/* 5. Pembelanjaan Per Pax */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Pembelanjaan Per Pax
              </span>
              <span
                className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                  data.kpis.spendPerPaxTrendPct >= 0
                    ? "bg-sky-50 text-sky-600"
                    : "bg-rose-50 text-rose-600"
                }`}
              >
                {data.kpis.spendPerPaxTrendPct >= 0 ? "+" : ""}
                {data.kpis.spendPerPaxTrendPct}%
              </span>
            </div>
            <div className="mt-3 text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(data.kpis.spendPerPax)}
            </div>
          </div>

          {/* 6. Penjualan Item Tertunda */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-xs flex flex-col justify-between">
            <div className="flex items-start justify-between">
              <span className="text-xs font-semibold text-slate-500">
                Penjualan Item Tertunda
              </span>
              <span className="rounded-md px-2 py-0.5 text-xs font-bold bg-slate-100 text-slate-500">
                0%
              </span>
            </div>
            <div className="mt-3 text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-900 tracking-tight">
              {formatRupiah(data.kpis.pendingSales)}
            </div>
          </div>
        </div>
      </div>

      {/* 3. Statistik Penjualan — Dual-Axis Hourly Line Chart */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
            Statistik Penjualan ({data.staff.outletName})
          </h3>
          {/* Legend */}
          <div className="flex items-center gap-5 text-xs sm:text-sm font-semibold text-slate-600">
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-sm bg-[#0284C7]" />
              <span>Total Penjualan Bersih</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="h-3.5 w-3.5 rounded-sm bg-[#EE607D]" />
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
            <div className="absolute top-2 right-4 rounded-xl bg-slate-900/95 px-4 py-2.5 text-xs text-white shadow-xl pointer-events-none">
              <div className="font-bold text-sky-400 text-sm">
                Jam {activeHourlyTooltip.hour} WIB
              </div>
              <div className="text-slate-200 mt-0.5">
                Penjualan: <strong>{formatRupiah(activeHourlyTooltip.sales)}</strong>
              </div>
              <div className="text-slate-300">
                Bill: <strong>{activeHourlyTooltip.bills} transaksi</strong>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. Tabel Stok Bahan Baku Kritis */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 md:p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
              Stok Bahan Baku ({data.staff.outletName})
            </h3>
            <p className="text-xs text-slate-500">
              Monitoring bahan baku kritis di bawah ambang batas aman
            </p>
          </div>
          {/* Badge Bel Oranye Peringatan */}
          <div className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs sm:text-sm font-semibold text-amber-900 shadow-2xs">
            <span className="text-base">🔔</span>
            <span>Di bawah batas aman stok:</span>
            <span className="rounded-md bg-amber-200 px-2 py-0.5 font-bold text-amber-950">
              {data.criticalStockCount} item
            </span>
          </div>
        </div>

        {/* Tabel */}
        <div className="overflow-x-auto rounded-xl border border-slate-100">
          <table className="w-full text-left text-sm">
            <thead className="bg-sky-50/70 text-slate-700 font-bold border-b border-slate-200/70">
              <tr>
                <th className="py-3 px-3.5 w-14">No.</th>
                <th className="py-3 px-3.5">Nama Bahan Baku</th>
                <th className="py-3 px-3.5 text-right">Batas Aman Stok</th>
                <th className="py-3 px-3.5 text-right">Stok Sekarang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {displayedStock.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-slate-400 italic">
                    Semua stok bahan baku cabang {data.staff.outletName} saat ini berada dalam batas aman.
                  </td>
                </tr>
              ) : (
                displayedStock.map((item, idx) => {
                  const rowNum = (stockPage - 1) * itemsPerPage + idx + 1;
                  const isNegative = item.currentStock < 0;
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3 px-3.5 text-slate-500 font-medium">
                        {rowNum}
                      </td>
                      <td className="py-3 px-3.5 font-bold text-slate-800">
                        {item.name}
                      </td>
                      <td className="py-3 px-3.5 text-right font-medium text-slate-600">
                        {item.minStock.toLocaleString("id-ID")} {item.unit}
                      </td>
                      <td
                        className={`py-3 px-3.5 text-right font-bold ${
                          isNegative
                            ? "text-rose-600 font-extrabold"
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
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={stockPage <= 1}
              onClick={() => setStockPage((p) => Math.max(1, p - 1))}
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40 cursor-pointer"
            >
              &lt;
            </button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => i + 1).map(
              (p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setStockPage(p)}
                  className={`rounded-lg px-3 py-1.5 font-bold cursor-pointer ${
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
              className="rounded-lg border border-slate-200 px-3 py-1.5 font-bold disabled:opacity-40 cursor-pointer"
            >
              &gt;
            </button>
          </div>
          <div>
            Menampilkan {displayedStock.length} dari {totalStockItems} data
          </div>
        </div>
      </div>

      {/* 5. Kontrol Fraud */}
      <div className="space-y-3">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Kontrol Fraud &amp; Pengurangan Pendapatan
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Card 1: Other Cost */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs border-l-4 border-l-amber-500 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Transaksi Other Cost
              </div>
              <div className="mt-1.5 text-xl font-extrabold text-slate-900">
                {formatRupiah(data.fraudControl.otherCost)}
              </div>
            </div>
            <Link
              href="/dashboard/keuangan"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284C7] text-white hover:bg-[#0369a1] transition shadow-xs"
            >
              &gt;
            </Link>
          </div>

          {/* Card 2: Komplimen / Diskon */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs border-l-4 border-l-amber-500 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Transaksi Komplimen &amp; Diskon
              </div>
              <div className="mt-1.5 text-xl font-extrabold text-slate-900">
                {formatRupiah(data.fraudControl.komplimen)}
              </div>
            </div>
            <Link
              href="/dashboard/transaksi"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284C7] text-white hover:bg-[#0369a1] transition shadow-xs"
            >
              &gt;
            </Link>
          </div>

          {/* Card 3: Pembatalan / Void */}
          <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs border-l-4 border-l-amber-500 flex items-center justify-between">
            <div>
              <div className="text-xs font-semibold text-slate-500">
                Pembatalan (Void)
              </div>
              <div className="mt-1.5 text-xl font-extrabold text-slate-900">
                {formatRupiah(data.fraudControl.voidAmount)}
              </div>
            </div>
            <Link
              href="/dashboard/transaksi"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0284C7] text-white hover:bg-[#0369a1] transition shadow-xs"
            >
              &gt;
            </Link>
          </div>
        </div>
      </div>

      {/* 6. Komposisi — 3 Diagram Donut/Pie */}
      <div className="space-y-3">
        <h3 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
          Komposisi Penjualan
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

      {/* 7. Section Tips Bisnis (Persis Screenshot Rekomendasi 5 Menu Terlaris & Kurang Laris) */}
      <div className="space-y-4" id="tabel-menu-terlaris">
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-xs space-y-5">
          {/* Header Tips Bisnis */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-3 border-b border-slate-100 dark:border-slate-800">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 tracking-tight">
              Tips Bisnis
            </h3>
            <span className="text-xs text-slate-400 font-medium">
              Data diperbarui pada {data.businessTips.lastUpdatedDateStr}
            </span>
          </div>

          {/* Banner Amber: Capai 10 transaksi per hari */}
          <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-[#FFFBEB] dark:bg-amber-950/40 p-3.5 text-xs sm:text-sm font-medium text-[#92400E] dark:text-amber-200 flex items-center gap-2">
            <span>Capai <strong>10 transaksi</strong> per hari untuk akurasi data yang lebih baik!</span>
          </div>

          {/* Grid Dua Kolom: Menu Terlaris vs Menu Kurang Laris */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Kolom Kiri: Menu Terlaris */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-base shrink-0">
                  📈
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Menu Terlaris
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pastikan stok menu favorit pelanggan selalu tersedia
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F1F5F9] dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3.5">Nama Menu</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Saran Stok Mingguan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                    {data.businessTips.topProducts.map((p, idx) => (
                      <tr
                        key={p.name}
                        className={idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : "bg-white dark:bg-slate-900"}
                      >
                        <td className="py-2.5 px-3.5 font-bold text-slate-800 dark:text-slate-100">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-extrabold text-slate-900 dark:text-slate-100">
                          {p.weeklySuggestedStock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Kolom Kanan: Menu Kurang Laris */}
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-base shrink-0">
                  📉
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">
                    Menu Kurang Laris
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Anda bisa sesuaikan stok untuk menu di bawah ini
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-slate-200/90 dark:border-slate-800">
                <table className="w-full text-left text-xs sm:text-sm">
                  <thead className="bg-[#F1F5F9] dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200/80 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3.5">Nama Menu</th>
                      <th className="py-2.5 px-3.5 text-right whitespace-nowrap">Saran Stok Mingguan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200 font-medium">
                    {data.businessTips.bottomProducts.map((p, idx) => (
                      <tr
                        key={p.name}
                        className={idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : "bg-white dark:bg-slate-900"}
                      >
                        <td className="py-2.5 px-3.5 font-bold text-slate-800 dark:text-slate-100">
                          {p.name}
                        </td>
                        <td className="py-2.5 px-3.5 text-right font-extrabold text-slate-900 dark:text-slate-100">
                          {p.weeklySuggestedStock}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Kotak Rekomendasi Penjualan (Lightbulb) */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 md:p-6 shadow-xs space-y-3">
          <div className="flex items-center gap-2.5 text-slate-900 dark:text-slate-100 font-bold text-sm sm:text-base">
            <span className="text-xl">💡</span>
            <h4>Rekomendasi untuk meningkatkan penjualan Anda</h4>
          </div>
          <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 font-medium leading-relaxed pl-1">
            <li>Sediakan stok bahan baku sesuai perkiraan penjualan yang terjadi, untuk meningkatkan efektifitas penjualan Anda.</li>
            <li>Buatlah menu dengan varian atau menu bundling antara menu terlaris dan kurang laris untuk memaksimalkan stok bahan baku Anda.</li>
            <li>Buatlah Promo Spesial menggunakan menu kurang laris pada hari atau jam tertentu.</li>
            <li>Lakukan eksplorasi menu dengan Varian baru untuk meningkatkan minat pelanggan.</li>
            <li>Fitur ini membutuhkan minimal 1 bulan data, segera pakai aplikasi POSLite Anda sekarang!</li>
          </ol>
        </div>

        {/* Disclaimer Note di Bagian Bawah */}
        <div className="text-center pt-1 pb-3 text-2xs sm:text-xs text-slate-400">
          Terdapat kemungkinan data yang ditampilkan tidak akurat. Harap periksa kembali kesesuaian data.
        </div>

        {/* Tabel Komparasi Cabang Terbaik */}
        <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3.5">
            <div>
              <h4 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Cabang Dengan Penjualan Terbaik
              </h4>
              <p className="text-xs text-slate-500">Komparasi performa antar cabang 1621 F&amp;B</p>
            </div>
            <span className="rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 px-2.5 py-1 text-xs font-bold border border-emerald-200 dark:border-emerald-800">
              1621 Group
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="py-2.5 px-3.5">Nama Cabang</th>
                  <th className="py-2.5 px-3.5 text-right">Penjualan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-200">
                {data.bestOutlets.map((b) => (
                  <tr key={b.name} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="py-3 px-3.5 font-bold text-slate-800 dark:text-slate-100">
                      {b.name}
                    </td>
                    <td className="py-3 px-3.5 text-right font-extrabold text-slate-900 dark:text-slate-100">
                      {formatRupiah(b.totalSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* MODAL POPUP: Tips Bisnis 5 Menu Terlaris (Muncul saat tombol diklik) */}
      {showTipsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-white dark:bg-slate-900 p-5 sm:p-7 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  Tips Bisnis — {data.staff.outletName}
                </h3>
                <p className="text-xs text-slate-500">
                  Data diperbarui pada {data.businessTips.lastUpdatedDateStr}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTipsModal(false)}
                className="h-8 w-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Banner Amber: Capai 10 transaksi per hari */}
            <div className="rounded-xl border border-amber-200 dark:border-amber-900/60 bg-[#FFFBEB] dark:bg-amber-950/40 p-3.5 text-xs sm:text-sm font-medium text-[#92400E] dark:text-amber-200 flex items-center gap-2">
              <span>Capai <strong>10 transaksi</strong> per hari untuk akurasi data yang lebih baik!</span>
            </div>

            {/* Grid Dua Kolom */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Menu Terlaris */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-sm shrink-0">
                    📈
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Menu Terlaris</h4>
                    <p className="text-xs text-slate-500">Pastikan stok menu favorit selalu tersedia</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#F1F5F9] dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Nama Menu</th>
                        <th className="py-2.5 px-3 text-right">Saran Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.businessTips.topProducts.map((p, idx) => (
                        <tr key={p.name} className={idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}>
                          <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">{p.name}</td>
                          <td className="py-2 px-3 text-right font-extrabold text-slate-900 dark:text-slate-100">{p.weeklySuggestedStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Menu Kurang Laris */}
              <div className="space-y-2.5">
                <div className="flex items-start gap-2.5">
                  <div className="h-7 w-7 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold text-sm shrink-0">
                    📉
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100">Menu Kurang Laris</h4>
                    <p className="text-xs text-slate-500">Sesuaikan stok untuk menu di bawah ini</p>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200/90 dark:border-slate-800 overflow-hidden">
                  <table className="w-full text-left text-xs sm:text-sm">
                    <thead className="bg-[#F1F5F9] dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold border-b border-slate-200 dark:border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Nama Menu</th>
                        <th className="py-2.5 px-3 text-right">Saran Stok</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {data.businessTips.bottomProducts.map((p, idx) => (
                        <tr key={p.name} className={idx % 2 === 1 ? "bg-slate-50/60 dark:bg-slate-800/30" : ""}>
                          <td className="py-2 px-3 font-bold text-slate-800 dark:text-slate-100">{p.name}</td>
                          <td className="py-2 px-3 text-right font-extrabold text-slate-900 dark:text-slate-100">{p.weeklySuggestedStock}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Rekomendasi 5 Poin */}
            <div className="rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-4 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 dark:text-slate-100 font-bold text-sm">
                <span>💡</span>
                <h4>Rekomendasi untuk meningkatkan penjualan Anda</h4>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs text-slate-600 dark:text-slate-300 font-medium pl-1 leading-relaxed">
                <li>Sediakan stok bahan baku sesuai perkiraan penjualan yang terjadi, untuk meningkatkan efektifitas penjualan Anda.</li>
                <li>Buatlah menu dengan varian atau menu bundling antara menu terlaris dan kurang laris untuk memaksimalkan stok bahan baku Anda.</li>
                <li>Buatlah Promo Spesial menggunakan menu kurang laris pada hari atau jam tertentu.</li>
                <li>Lakukan eksplorasi menu dengan Varian baru untuk meningkatkan minat pelanggan.</li>
                <li>Fitur ini membutuhkan minimal 1 bulan data, segera pakai aplikasi POSLite Anda sekarang!</li>
              </ol>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowTipsModal(false)}
                className="rounded-xl bg-[#0284C7] px-5 py-2.5 text-xs font-bold text-white hover:bg-[#0369a1] transition cursor-pointer"
              >
                Tutup Tips Bisnis
              </button>
            </div>
          </div>
        </div>
      )}
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
              className="text-[11px] fill-slate-400 font-medium"
            >
              {salesVal === 0 ? "0,00" : (salesVal / 1000).toLocaleString("id-ID") + " rb"}
            </text>
            {/* Right Y Axis Label (Bills) */}
            <text
              x={chartWidth - paddingRight + 8}
              y={y + 4}
              textAnchor="start"
              className="text-[11px] fill-slate-400 font-medium"
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
            className="text-[11px] fill-slate-500 font-semibold"
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
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Line 2: Total Bill (Merah/Coral) */}
      <path
        d={billsPathD}
        fill="none"
        stroke="#EE607D"
        strokeWidth="3"
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
            r="4.5"
            fill="#0284C7"
            stroke="#FFFFFF"
            strokeWidth="2"
            className="cursor-pointer transition-transform hover:scale-150"
            onMouseEnter={() => onHoverPoint(c.point)}
            onMouseLeave={() => onHoverPoint(null)}
          />
          {/* Red Point */}
          <circle
            cx={billsCoords[i]?.x ?? c.x}
            cy={billsCoords[i]?.y ?? c.y}
            r="4.5"
            fill="#EE607D"
            stroke="#FFFFFF"
            strokeWidth="2"
            className="cursor-pointer transition-transform hover:scale-150"
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
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs flex flex-col justify-between">
      <div>
        <h4 className="text-center text-sm font-bold text-slate-800 mb-4">
          {title}
        </h4>

        {/* SVG Pie Chart */}
        <div className="flex justify-center my-2">
          <SimpleSvgPie slices={slices} size={150} />
        </div>
      </div>

      {/* Detail Table */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <table className="w-full text-left text-xs">
          <thead className="text-slate-500 font-bold border-b border-slate-100">
            <tr>
              <th className="pb-2">{typeColumnName}</th>
              <th className="pb-2 text-right">Porsi</th>
              <th className="pb-2 text-right">Persentase</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 text-slate-700 font-medium">
            {slices.map((s) => (
              <tr key={s.label}>
                <td className="py-2 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="truncate max-w-[120px] font-bold text-slate-800">
                    {s.label}
                  </span>
                </td>
                <td className="py-2 text-right font-medium">
                  {formatRupiah(s.value)}
                </td>
                <td className="py-2 text-right font-extrabold text-slate-900">
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
