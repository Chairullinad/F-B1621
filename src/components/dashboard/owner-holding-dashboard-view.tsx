"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  LineChart,
  Plus,
  Settings,
  Store,
  TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { formatRupiah } from "@/lib/money";
import type { OwnerHoldingAnalyticsData } from "@/server/owner-holding-analytics";
import { switchActiveOutletAction } from "@/server/outlets";

interface OwnerHoldingDashboardViewProps {
  initialData: OwnerHoldingAnalyticsData;
  promptSelectOutlet?: boolean;
}

const MONTH_FULL_NAMES_ID = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
] as const;

function formatCompactRupiahAxis(value: number): string {
  if (value <= 0) return "Rp 0";
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1).replace(".0", "")} M`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(1).replace(".0", "")} jt`;
  }
  if (value >= 1_000) {
    return `Rp ${Math.round(value / 1_000)} rb`;
  }
  return `Rp ${value}`;
}

export function OwnerHoldingDashboardView({
  initialData,
  promptSelectOutlet = false,
}: OwnerHoldingDashboardViewProps) {
  const router = useRouter();
  const [enteringOutletId, setEnteringOutletId] = React.useState<string | null>(
    null
  );
  const [isPending, startTransition] = React.useTransition();
  const [chartMode, setChartMode] = React.useState<"line" | "bar">("line");
  const [hoveredMonthIdx, setHoveredMonthIdx] = React.useState<number | null>(
    null
  );

  // State toggle legend per outlet (semua aktif secara default)
  const [hiddenOutletIds, setHiddenOutletIds] = React.useState<Set<string>>(
    () => new Set()
  );

  const visibleOutlets = React.useMemo(() => {
    return initialData.outlets.filter(
      (item) => !hiddenOutletIds.has(item.outlet.id)
    );
  }, [initialData.outlets, hiddenOutletIds]);

  const toggleOutletSeries = (outletId: string) => {
    setHiddenOutletIds((prev) => {
      const next = new Set(prev);
      if (next.has(outletId)) {
        next.delete(outletId);
      } else {
        // Sisakan minimal 1 garis agar grafik tidak kosong bila masih ada > 1 outlet
        if (next.size < Math.max(0, initialData.outlets.length - 1)) {
          next.add(outletId);
        } else {
          toast.info("Minimal 1 usaha ditampilkan pada grafik.");
        }
      }
      return next;
    });
  };

  const handleEnterOutlet = (outletId: string) => {
    setEnteringOutletId(outletId);
    startTransition(async () => {
      try {
        const res = await switchActiveOutletAction(outletId);
        if (res.ok) {
          toast.success(res.message);
          if (typeof window !== "undefined" && window.location.search) {
            router.replace("/dashboard");
          }
          router.refresh();
        } else {
          setEnteringOutletId(null);
          toast.error(res.message);
        }
      } catch {
        setEnteringOutletId(null);
        toast.error("Gagal masuk ke dashboard outlet. Silakan coba lagi.");
      }
    });
  };

  const handleYearChange = (yearValue: string) => {
    router.push(`/dashboard?year=${encodeURIComponent(yearValue)}`);
  };

  const handleDateRangeApply = ({
    startDate,
    endDate,
  }: {
    startDate: string;
    endDate: string;
  }) => {
    router.push(
      `/dashboard?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`
    );
  };

  const handleDateRangeReset = () => {
    router.push(`/dashboard?year=${encodeURIComponent(String(initialData.selectedYear))}`);
  };

  // Skala sumbu Y untuk grafik bulanan
  const maxMonthlyValue = React.useMemo(() => {
    let maxVal = 0;
    for (const summary of visibleOutlets) {
      for (const val of summary.monthlySeries) {
        if (val > maxVal) maxVal = val;
      }
    }
    if (maxVal <= 0) return 1_000_000;
    const magnitude = Math.pow(10, Math.floor(Math.log10(maxVal)));
    const niceUnit = magnitude / 2;
    return Math.ceil(maxVal / niceUnit) * niceUnit;
  }, [visibleOutlets]);

  // Koordinat SVG responsif
  const svgW = 920;
  const svgH = 340;
  const padL = 74;
  const padR = 24;
  const padT = 24;
  const padB = 40;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;

  const bucketCount = Math.max(1, initialData.monthlyChart.length);

  const getMonthCenterX = (monthIdx: number): number => {
    if (chartMode === "line") {
      if (bucketCount <= 1) {
        return padL + plotW / 2;
      }
      return padL + (monthIdx / (bucketCount - 1)) * plotW;
    }
    const bandW = plotW / bucketCount;
    return padL + monthIdx * bandW + bandW / 2;
  };

  const getY = (val: number): number => {
    const ratio = Math.min(1, Math.max(0, val / maxMonthlyValue));
    return padT + plotH - ratio * plotH;
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((r) => ({
    ratio: r,
    value: Math.round(maxMonthlyValue * r),
    y: padT + plotH - r * plotH,
  }));

  const currentMonthLabel =
    initialData.selectedYear === initialData.currentWibYear
      ? MONTH_FULL_NAMES_ID[initialData.currentWibMonth]
      : "Desember";

  const activeTooltipMonth =
    hoveredMonthIdx !== null
      ? initialData.monthlyChart[hoveredMonthIdx] ?? null
      : null;

  return (
    <div className="space-y-6 bg-[#F4F7FA] dark:bg-slate-950 -m-4 md:-m-6 p-4 md:p-6 min-h-screen font-sans text-slate-800 dark:text-slate-100">
      {/* Banner Prompt apabila Owner diarahkan dari route operasional sebelum memilih outlet */}
      {promptSelectOutlet && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-sm text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
          <span>
            Silakan pilih dan klik salah satu outlet di bawah terlebih dahulu
            untuk membuka menu operasional kasir, menu, dapur, atau stok.
          </span>
        </div>
      )}

      {/* Header Portal Owner */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 border border-sky-200/80 dark:border-sky-800 px-3 py-1 text-xs font-semibold text-[#1E88E5] dark:text-sky-300">
            <Building2 className="h-3.5 w-3.5" />
            <span>Portal Holding Owner &bull; Semua Outlet</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100 mt-2">
            Ringkasan Outlet &amp; Grafik Penjualan
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Klik salah satu outlet di bawah untuk langsung masuk ke dashboard
            operasionalnya, atau pantau performa gabungan seluruh outlet.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 h-11 shadow-2xs">
            <Calendar className="h-4 w-4 text-slate-400" />
            <label
              htmlFor="holding-year-select"
              className="text-xs font-semibold text-slate-500 dark:text-slate-400"
            >
              Tahun:
            </label>
            <select
              id="holding-year-select"
              value={initialData.selectedYear}
              onChange={(e) => handleYearChange(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-800 dark:text-slate-100 focus:outline-none cursor-pointer"
            >
              {initialData.availableYears.map((yr) => (
                <option
                  key={yr}
                  value={yr}
                  className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100"
                >
                  {yr}
                </option>
              ))}
            </select>
          </div>

          <DateRangeFilter
            startDate={initialData.activeStartDate ?? ""}
            endDate={initialData.activeEndDate ?? ""}
            hasActiveCustomRange={Boolean(initialData.rangeLabel)}
            onApply={handleDateRangeApply}
            onReset={handleDateRangeReset}
          />

          <Link
            href="/dashboard/cabang"
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#1E88E5] hover:bg-[#1976D2] px-4 text-sm font-semibold text-white transition shadow-2xs"
          >
            <Settings className="h-4 w-4" />
            <span>Setting Outlet</span>
          </Link>
        </div>
      </div>

      {/* Pilihan Outlet untuk Masuk (Paling Atas di Bawah Header, Klik Kartu Langsung Masuk) */}
      <section className="space-y-3">
        {initialData.outlets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 text-center">
            <Store className="mx-auto h-10 w-10 text-slate-400" />
            <h3 className="mt-3 text-base font-bold text-slate-900 dark:text-slate-100">
              Belum ada outlet terdaftar
            </h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Tambahkan outlet pertama Anda melalui menu Setting Outlet.
            </p>
            <Link
              href="/dashboard/cabang?tambah=1"
              className="mt-4 inline-flex h-11 items-center gap-2 rounded-xl bg-[#1E88E5] px-5 text-sm font-semibold text-white hover:bg-[#1976D2]"
            >
              <Plus className="h-4 w-4" />
              <span>Buat Outlet Baru</span>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {initialData.outlets.map((summary) => {
              const { outlet, chartColor } = summary;
              const isEntering = isPending && enteringOutletId === outlet.id;

              return (
                <button
                  key={outlet.id}
                  type="button"
                  onClick={() => handleEnterOutlet(outlet.id)}
                  disabled={isPending}
                  className="group relative flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-left shadow-xs transition hover:border-[#1E88E5]/60 hover:shadow-md dark:hover:border-sky-600/60 active:scale-[0.99] disabled:opacity-60 cursor-pointer"
                >
                  {/* Garis Warna Identitas Outlet di Bagian Atas Kartu */}
                  <div
                    className="h-1.5 w-full"
                    style={{ backgroundColor: chartColor }}
                  />

                  <div className="p-4 sm:p-5 flex items-center gap-3.5 w-full">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1.5 overflow-hidden shadow-2xs">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={outlet.logoUrl}
                        alt={outlet.name}
                        className="h-full w-full object-contain"
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="truncate text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#1E88E5] dark:group-hover:text-sky-400 transition-colors">
                          {outlet.name}
                        </h3>
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: chartColor }}
                          />
                          {outlet.isActive ? "Aktif" : "Nonaktif"}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                        {outlet.description || "Usaha Kuliner & F&B"}
                      </p>
                      {outlet.address && (
                        <p className="mt-0.5 truncate text-[11px] text-slate-400 dark:text-slate-500">
                          {outlet.address}
                        </p>
                      )}
                      <div className="mt-2 inline-flex items-center gap-1 text-[11px] font-semibold text-[#1E88E5] dark:text-sky-400">
                        <span>
                          {isEntering
                            ? "Membuka Dashboard Outlet..."
                            : "Masuk ke Dashboard Outlet"}
                        </span>
                        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      {/* 4 KPI Gabungan Seluruh Outlet */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {initialData.rangeLabel
              ? `Total Penjualan (${initialData.rangeLabel})`
              : `Total Penjualan ${initialData.selectedYear}`}
          </div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {formatRupiah(initialData.totalAnnualSales)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Dari {initialData.totalAnnualBills.toLocaleString("id-ID")} transaksi lunas gabungan
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            {initialData.rangeLabel
              ? "Rata-Rata Omset / Hari"
              : `Omset ${currentMonthLabel} ${initialData.selectedYear}`}
          </div>
          <div className="mt-1.5 text-2xl font-bold text-[#1E88E5] dark:text-sky-400">
            {formatRupiah(initialData.totalCurrentMonthSales)}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {initialData.rangeLabel
              ? `${initialData.totalCurrentMonthBills.toLocaleString("id-ID")} bill dalam ${initialData.rangeDayCount} hari`
              : `${initialData.totalCurrentMonthBills.toLocaleString("id-ID")} bill pada bulan ini`}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Total Outlet
          </div>
          <div className="mt-1.5 text-2xl font-bold text-slate-900 dark:text-slate-100">
            {initialData.totalOutlets} Outlet
          </div>
          <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
            {initialData.activeOutletsCount} outlet berstatus aktif
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Outlet Performa Tertinggi
          </div>
          <div className="mt-1.5 text-xl font-bold text-slate-900 dark:text-slate-100 truncate">
            {initialData.bestOutletName ?? "Belum Ada Data"}
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
            <span>
              {initialData.bestOutletName
                ? `${formatRupiah(initialData.bestOutletSales)} (${initialData.rangeLabel ?? initialData.selectedYear})`
                : "Menunggu transaksi pertama"}
            </span>
          </div>
        </div>
      </div>

      {/* Grafik Penjualan Tiap Outlet (Warna Berbeda Per Outlet) */}
      <section className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
              {initialData.rangeLabel
                ? `Grafik Penjualan Outlet (${initialData.rangeLabel})`
                : `Grafik Penjualan Per Bulan Tiap Outlet (${initialData.selectedYear})`}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              Setiap warna mewakili satu outlet (waktu WIB). Klik nama outlet di legenda untuk menyaring tampilan grafik.
            </p>
          </div>

          <div className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 p-1 self-start md:self-auto">
            <button
              type="button"
              onClick={() => setChartMode("line")}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition cursor-pointer ${
                chartMode === "line"
                  ? "bg-white dark:bg-slate-900 text-[#1E88E5] shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <LineChart className="h-3.5 w-3.5" />
              <span>Garis</span>
            </button>
            <button
              type="button"
              onClick={() => setChartMode("bar")}
              className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition cursor-pointer ${
                chartMode === "bar"
                  ? "bg-white dark:bg-slate-900 text-[#1E88E5] shadow-2xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Batang</span>
            </button>
          </div>
        </div>

        {/* Legenda Warna Unik Tiap Outlet */}
        {initialData.outlets.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {initialData.outlets.map((summary) => {
              const isHidden = hiddenOutletIds.has(summary.outlet.id);
              return (
                <button
                  key={summary.outlet.id}
                  type="button"
                  onClick={() => toggleOutletSeries(summary.outlet.id)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition cursor-pointer ${
                    isHidden
                      ? "border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-800/40 text-slate-400 line-through"
                      : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-2xs hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  <span
                    className="h-3 w-3 rounded-full shrink-0"
                    style={{
                      backgroundColor: summary.chartColor,
                      opacity: isHidden ? 0.35 : 1,
                    }}
                  />
                  <span>{summary.outlet.name}</span>
                  <span className="text-[11px] font-normal text-slate-500 dark:text-slate-400">
                    ({formatCompactRupiahAxis(summary.annualSales)})
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Kanvas SVG Grafik Multi-Outlet */}
        <div className="relative overflow-x-auto">
          <div className="min-w-[640px] relative">
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full h-auto select-none"
              role="img"
              aria-label={`Grafik penjualan per bulan tahun ${initialData.selectedYear} untuk setiap outlet`}
              onMouseLeave={() => setHoveredMonthIdx(null)}
            >
              {/* Grid Horizontal & Label Sumbu Y */}
              {yTicks.map((tick) => (
                <g key={tick.ratio}>
                  <line
                    x1={padL}
                    x2={svgW - padR}
                    y1={tick.y}
                    y2={tick.y}
                    stroke="currentColor"
                    strokeDasharray={tick.ratio === 0 ? undefined : "4 4"}
                    className={
                      tick.ratio === 0
                        ? "text-slate-300 dark:text-slate-700"
                        : "text-slate-200 dark:text-slate-800"
                    }
                    strokeWidth={1}
                  />
                  <text
                    x={padL - 10}
                    y={tick.y + 4}
                    textAnchor="end"
                    className="fill-slate-500 dark:fill-slate-400 text-[11px] font-medium"
                  >
                    {formatCompactRupiahAxis(tick.value)}
                  </text>
                </g>
              ))}

              {/* Sorotan Kolom Bulan Saat Hover */}
              {hoveredMonthIdx !== null && (
                <line
                  x1={getMonthCenterX(hoveredMonthIdx)}
                  x2={getMonthCenterX(hoveredMonthIdx)}
                  y1={padT}
                  y2={padT + plotH}
                  stroke="currentColor"
                  strokeDasharray="3 3"
                  className="text-slate-400 dark:text-slate-500"
                  strokeWidth={1.5}
                />
              )}

              {/* Mode Grafik Garis */}
              {chartMode === "line" &&
                visibleOutlets.map((summary) => {
                  const points = summary.monthlySeries
                    .map((val, mIdx) => `${getMonthCenterX(mIdx)},${getY(val)}`)
                    .join(" ");

                  return (
                    <g key={summary.outlet.id}>
                      <polyline
                        fill="none"
                        stroke={summary.chartColor}
                        strokeWidth={3}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        points={points}
                      />
                      {summary.monthlySeries.map((val, mIdx) => {
                        const isHighlighted = hoveredMonthIdx === mIdx;
                        return (
                          <circle
                            key={`${summary.outlet.id}-${mIdx}`}
                            cx={getMonthCenterX(mIdx)}
                            cy={getY(val)}
                            r={isHighlighted ? 6 : 4}
                            fill={summary.chartColor}
                            stroke="#FFFFFF"
                            strokeWidth={isHighlighted ? 2.5 : 1.5}
                          />
                        );
                      })}
                    </g>
                  );
                })}

              {/* Mode Grafik Batang Berkelompok */}
              {chartMode === "bar" &&
                initialData.monthlyChart.map((bucket) => {
                  const bandW = plotW / bucketCount;
                  const innerPad = 6;
                  const groupW = Math.max(12, bandW - innerPad * 2);
                  const count = Math.max(1, visibleOutlets.length);
                  const barW = Math.max(4, Math.min(24, (groupW - (count - 1) * 3) / count));
                  const totalGroupBarsW = count * barW + (count - 1) * 3;
                  const startX = padL + bucket.monthIndex * bandW + (bandW - totalGroupBarsW) / 2;

                  return (
                    <g key={`bars-${bucket.monthIndex}`}>
                      {visibleOutlets.map((summary, sIdx) => {
                        const val = summary.monthlySeries[bucket.monthIndex] ?? 0;
                        const y = getY(val);
                        const h = Math.max(val > 0 ? 3 : 0, padT + plotH - y);
                        const x = startX + sIdx * (barW + 3);
                        return (
                          <rect
                            key={`${summary.outlet.id}-bar-${bucket.monthIndex}`}
                            x={x}
                            y={y}
                            width={barW}
                            height={h}
                            rx={3}
                            fill={summary.chartColor}
                            opacity={
                              hoveredMonthIdx === null ||
                              hoveredMonthIdx === bucket.monthIndex
                                ? 0.92
                                : 0.45
                            }
                          />
                        );
                      })}
                    </g>
                  );
                })}

              {/* Label X-Axis & Zona Interaktif Hover/Klik */}
              {initialData.monthlyChart.map((bucket) => {
                const cx = getMonthCenterX(bucket.monthIndex);
                const bandW = plotW / bucketCount;
                const hitX =
                  chartMode === "line"
                    ? bucketCount <= 1
                      ? padL
                      : bucket.monthIndex === 0
                        ? padL
                        : cx - bandW / 2
                    : padL + bucket.monthIndex * bandW;

                return (
                  <g key={`axis-${bucket.monthIndex}`}>
                    <text
                      x={cx}
                      y={svgH - 12}
                      textAnchor="middle"
                      className={`text-[11px] font-semibold ${
                        hoveredMonthIdx === bucket.monthIndex
                          ? "fill-[#1E88E5] dark:fill-sky-400"
                          : "fill-slate-500 dark:fill-slate-400"
                      }`}
                    >
                      {bucket.monthLabel}
                    </text>
                    <rect
                      x={hitX}
                      y={padT}
                      width={bandW}
                      height={plotH + padB - 10}
                      fill="transparent"
                      className="cursor-crosshair"
                      onMouseEnter={() => setHoveredMonthIdx(bucket.monthIndex)}
                      onClick={() =>
                        setHoveredMonthIdx((prev) =>
                          prev === bucket.monthIndex ? null : bucket.monthIndex
                        )
                      }
                    />
                  </g>
                );
              })}
            </svg>

            {/* Tooltip Detail Periode Aktif */}
            {activeTooltipMonth && (
              <div className="mt-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 px-4 py-3 text-xs shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-700 pb-2 mb-2">
                  <span className="font-bold text-slate-900 dark:text-slate-100">
                    {initialData.rangeLabel
                      ? `Rincian ${activeTooltipMonth.monthLabel}`
                      : `Rincian Bulan ${MONTH_FULL_NAMES_ID[activeTooltipMonth.monthIndex]} ${initialData.selectedYear}`}
                  </span>
                  <span className="font-semibold text-[#1E88E5] dark:text-sky-400">
                    Total Gabungan: {formatRupiah(activeTooltipMonth.totalSales)} (
                    {activeTooltipMonth.totalBills} transaksi)
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {visibleOutlets.map((summary) => {
                    const pt = activeTooltipMonth.byOutlet[summary.outlet.id];
                    return (
                      <div
                        key={summary.outlet.id}
                        className="flex items-center justify-between gap-2 rounded-lg bg-white dark:bg-slate-900 px-3 py-1.5 border border-slate-200/70 dark:border-slate-700"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: summary.chartColor }}
                          />
                          <span className="truncate font-semibold text-slate-800 dark:text-slate-100">
                            {summary.outlet.name}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {formatRupiah(pt?.sales ?? 0)}
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {pt?.bills ?? 0} bill
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Matriks Ringkas Penjualan Bulanan Tiap Outlet */}
        {initialData.outlets.length > 0 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 pr-3 font-semibold">Outlet</th>
                  {initialData.monthlyChart.map((m) => (
                    <th key={m.monthIndex} className="py-2 px-1.5 font-semibold text-right">
                      {m.monthLabel}
                    </th>
                  ))}
                  <th className="py-2 pl-3 font-bold text-right text-slate-700 dark:text-slate-200">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/70">
                {initialData.outlets.map((summary) => (
                  <tr
                    key={summary.outlet.id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40"
                  >
                    <td className="py-2.5 pr-3 font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: summary.chartColor }}
                        />
                        <span>{summary.outlet.name}</span>
                      </div>
                    </td>
                    {summary.monthlySeries.map((val, idx) => (
                      <td
                        key={idx}
                        className={`py-2.5 px-1.5 text-right tabular-nums ${
                          val > 0
                            ? "font-medium text-slate-800 dark:text-slate-200"
                            : "text-slate-400 dark:text-slate-600"
                        }`}
                      >
                        {val > 0 ? formatCompactRupiahAxis(val).replace("Rp ", "") : "-"}
                      </td>
                    ))}
                    <td className="py-2.5 pl-3 text-right font-bold text-slate-900 dark:text-slate-100 whitespace-nowrap">
                      {formatRupiah(summary.annualSales)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
