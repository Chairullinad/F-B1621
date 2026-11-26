"use server";

import { parseWibDateRange } from "@/lib/datetime";
import {
  assignDistinctOutletColors,
  mapOutletRowToView,
  type OutletView,
} from "@/lib/outlets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types/database";
import { requireStaffRole } from "@/server/auth";
import { fetchAllPaginated } from "@/server/query-helpers";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const MONTH_SHORT_LABELS_ID = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
] as const;

export interface HoldingMonthlyOutletPoint {
  outletId: string;
  sales: number;
  bills: number;
}

export interface HoldingMonthlyBucket {
  monthIndex: number;
  monthLabel: string;
  totalSales: number;
  totalBills: number;
  byOutlet: Record<string, HoldingMonthlyOutletPoint>;
}

export interface HoldingOutletSummary {
  outlet: OutletView;
  chartColor: string;
  annualSales: number;
  annualBills: number;
  currentMonthSales: number;
  currentMonthBills: number;
  monthlySeries: number[];
  monthlyBills: number[];
}

export interface OwnerHoldingAnalyticsData {
  selectedYear: number;
  currentWibYear: number;
  currentWibMonth: number;
  availableYears: number[];
  activeStartDate: string | null;
  activeEndDate: string | null;
  rangeLabel: string | null;
  rangeDayCount: number;
  totalOutlets: number;
  activeOutletsCount: number;
  totalAnnualSales: number;
  totalAnnualBills: number;
  totalCurrentMonthSales: number;
  totalCurrentMonthBills: number;
  bestOutletName: string | null;
  bestOutletSales: number;
  outlets: HoldingOutletSummary[];
  monthlyChart: HoldingMonthlyBucket[];
}

function getWibYearMonthFromDate(date: Date): { year: number; month: number } {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
  };
}

function formatWibDayKeyFromDate(date: Date): string {
  const shifted = new Date(date.getTime() + WIB_OFFSET_MS);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWibYearMonthFromIso(iso: string): { year: number; month: number } | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }
  return getWibYearMonthFromDate(parsed);
}

function isCountedPaidStatus(status: OrderStatus): boolean {
  return status === "paid" || status === "ready" || status === "served";
}

export async function getOwnerHoldingAnalytics(params?: {
  year?: number;
  startDate?: string;
  endDate?: string;
}): Promise<OwnerHoldingAnalyticsData> {
  await requireStaffRole(["owner"]);

  const admin = createSupabaseAdminClient();
  const nowWib = getWibYearMonthFromDate(new Date());
  const customRange = parseWibDateRange(params?.startDate, params?.endDate);

  const requestedYear = params?.year;
  const fallbackYear = customRange
    ? Number.parseInt(customRange.startDateWib.slice(0, 4), 10)
    : nowWib.year;
  const selectedYear =
    requestedYear &&
    Number.isInteger(requestedYear) &&
    requestedYear >= 2020 &&
    requestedYear <= nowWib.year + 1
      ? requestedYear
      : fallbackYear;

  // Batas UTC untuk query orders (custom range WIB atau 1 tahun penuh WIB)
  const rangeStartUtcMs = customRange
    ? Date.parse(customRange.startIso)
    : Date.UTC(selectedYear, 0, 1, 0, 0, 0) - WIB_OFFSET_MS;
  const rangeEndUtcMs = customRange
    ? Date.parse(customRange.endIso)
    : Date.UTC(selectedYear + 1, 0, 1, 0, 0, 0) - WIB_OFFSET_MS - 1;
  const queryStartUtc = new Date(rangeStartUtcMs - 3 * 24 * 60 * 60 * 1000);
  const queryEndUtc = new Date(rangeEndUtcMs + 1);

  const [outletsRes, earliestOrderRes, yearOrders] = await Promise.all([
    admin
      .from("outlets")
      .select(
        "id, name, address, phone, description, receipt_footer, logo_url, theme_color, is_active, order_expiry_minutes, tax_enabled, tax_percent, service_enabled, service_percent, created_at, deleted_at, operating_hours, landing_tagline"
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("orders")
      .select("created_at")
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    fetchAllPaginated<{
      outlet_id: string;
      status: OrderStatus;
      total: number | null;
      paid_at: string | null;
      created_at: string | null;
    }>((from, to) =>
      admin
        .from("orders")
        .select("outlet_id, status, total, paid_at, created_at")
        .is("deleted_at", null)
        .gte("created_at", queryStartUtc.toISOString())
        .lt("created_at", queryEndUtc.toISOString())
        .order("created_at", { ascending: true })
        .range(from, to)
    ),
  ]);

  const rawOutlets = (outletsRes.data ?? []) as Record<string, unknown>[];
  const mappedOutlets = rawOutlets.map(mapOutletRowToView);
  const colorMap = assignDistinctOutletColors(mappedOutlets);

  // Hitung daftar tahun yang tersedia
  const yearsSet = new Set<number>([nowWib.year, selectedYear]);
  const earliestIso = earliestOrderRes.data?.created_at
    ? String(earliestOrderRes.data.created_at)
    : null;
  if (earliestIso) {
    const earliestWib = getWibYearMonthFromIso(earliestIso);
    if (earliestWib && earliestWib.year >= 2020) {
      for (let y = earliestWib.year; y <= nowWib.year; y++) {
        yearsSet.add(y);
      }
    }
  }
  const availableYears = Array.from(yearsSet).sort((a, b) => b - a);

  // Tentukan sumbu bucket grafik:
  // - Mode tahunan: 12 bulan (Jan..Des)
  // - Mode rentang tanggal <= 31 hari: per tanggal WIB
  // - Mode rentang tanggal > 31 hari: per bulan dalam rentang (YYYY-MM)
  const useDailyBuckets = Boolean(customRange && customRange.dayCount <= 31);
  const bucketKeys: string[] = [];
  const bucketLabels: string[] = [];

  if (customRange && useDailyBuckets) {
    const dayMs = 24 * 60 * 60 * 1000;
    const shortFmt = new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
    });
    for (let i = 0; i < customRange.dayCount; i++) {
      const utcMidMs = rangeStartUtcMs + i * dayMs;
      const dt = new Date(utcMidMs);
      bucketKeys.push(formatWibDayKeyFromDate(dt));
      bucketLabels.push(shortFmt.format(dt));
    }
  } else if (customRange) {
    const startYear = Number.parseInt(customRange.startDateWib.slice(0, 4), 10);
    const startMonth = Number.parseInt(customRange.startDateWib.slice(5, 7), 10) - 1;
    const endYear = Number.parseInt(customRange.endDateWib.slice(0, 4), 10);
    const endMonth = Number.parseInt(customRange.endDateWib.slice(5, 7), 10) - 1;
    let curY = startYear;
    let curM = startMonth;
    while (curY < endYear || (curY === endYear && curM <= endMonth)) {
      const mm = String(curM + 1).padStart(2, "0");
      bucketKeys.push(`${curY}-${mm}`);
      bucketLabels.push(
        startYear === endYear
          ? MONTH_SHORT_LABELS_ID[curM] ?? mm
          : `${MONTH_SHORT_LABELS_ID[curM] ?? mm} '${String(curY).slice(-2)}`
      );
      curM += 1;
      if (curM >= 12) {
        curM = 0;
        curY += 1;
      }
      if (bucketKeys.length >= 36) break;
    }
  } else {
    for (let m = 0; m < 12; m++) {
      bucketKeys.push(`${selectedYear}-${String(m + 1).padStart(2, "0")}`);
      bucketLabels.push(MONTH_SHORT_LABELS_ID[m] ?? String(m + 1));
    }
  }

  const bucketIndexByKey = new Map<string, number>();
  bucketKeys.forEach((key, idx) => bucketIndexByKey.set(key, idx));
  const bucketCount = Math.max(1, bucketLabels.length);

  // Inisialisasi akumulator per outlet
  const outletMonthlySales = new Map<string, number[]>();
  const outletMonthlyBills = new Map<string, number[]>();
  for (const outlet of mappedOutlets) {
    outletMonthlySales.set(outlet.id, new Array<number>(bucketCount).fill(0));
    outletMonthlyBills.set(outlet.id, new Array<number>(bucketCount).fill(0));
  }

  for (const row of yearOrders) {
    const status = row.status as OrderStatus;
    if (!isCountedPaidStatus(status)) {
      continue;
    }
    const outletId = String(row.outlet_id ?? "");
    const salesArr = outletMonthlySales.get(outletId);
    const billsArr = outletMonthlyBills.get(outletId);
    if (!salesArr || !billsArr) {
      continue;
    }

    const effectiveTs = String(row.paid_at || row.created_at || "");
    const effectiveMs = Date.parse(effectiveTs);
    if (
      Number.isNaN(effectiveMs) ||
      effectiveMs < rangeStartUtcMs ||
      effectiveMs > rangeEndUtcMs
    ) {
      continue;
    }

    const effectiveDate = new Date(effectiveMs);
    let key: string;
    if (useDailyBuckets) {
      key = formatWibDayKeyFromDate(effectiveDate);
    } else {
      const ym = getWibYearMonthFromDate(effectiveDate);
      key = `${ym.year}-${String(ym.month + 1).padStart(2, "0")}`;
    }

    const bucketIdx = bucketIndexByKey.get(key);
    if (bucketIdx === undefined) {
      continue;
    }

    const total = Number(row.total ?? 0);
    if (!Number.isFinite(total)) {
      continue;
    }

    salesArr[bucketIdx] = (salesArr[bucketIdx] ?? 0) + Math.round(total);
    billsArr[bucketIdx] = (billsArr[bucketIdx] ?? 0) + 1;
  }

  const targetMonthIndex =
    selectedYear === nowWib.year ? nowWib.month : 11;

  const outletSummaries: HoldingOutletSummary[] = mappedOutlets.map((outlet) => {
    const monthlySeries =
      outletMonthlySales.get(outlet.id) ?? new Array<number>(bucketCount).fill(0);
    const monthlyBills =
      outletMonthlyBills.get(outlet.id) ?? new Array<number>(bucketCount).fill(0);
    const annualSales = monthlySeries.reduce((acc, v) => acc + v, 0);
    const annualBills = monthlyBills.reduce((acc, v) => acc + v, 0);

    return {
      outlet,
      chartColor: colorMap.get(outlet.id) ?? "#0284C7",
      annualSales,
      annualBills,
      currentMonthSales: customRange
        ? Math.round(annualSales / customRange.dayCount)
        : (monthlySeries[targetMonthIndex] ?? 0),
      currentMonthBills: customRange
        ? annualBills
        : (monthlyBills[targetMonthIndex] ?? 0),
      monthlySeries,
      monthlyBills,
    };
  });

  const monthlyChart: HoldingMonthlyBucket[] = bucketLabels.map(
    (monthLabel, monthIndex) => {
      const byOutlet: Record<string, HoldingMonthlyOutletPoint> = {};
      let totalSales = 0;
      let totalBills = 0;

      for (const summary of outletSummaries) {
        const sales = summary.monthlySeries[monthIndex] ?? 0;
        const bills = summary.monthlyBills[monthIndex] ?? 0;
        byOutlet[summary.outlet.id] = {
          outletId: summary.outlet.id,
          sales,
          bills,
        };
        totalSales += sales;
        totalBills += bills;
      }

      return {
        monthIndex,
        monthLabel,
        totalSales,
        totalBills,
        byOutlet,
      };
    }
  );

  const totalAnnualSales = outletSummaries.reduce(
    (acc, item) => acc + item.annualSales,
    0
  );
  const totalAnnualBills = outletSummaries.reduce(
    (acc, item) => acc + item.annualBills,
    0
  );
  const totalCurrentMonthSales = customRange
    ? Math.round(totalAnnualSales / customRange.dayCount)
    : outletSummaries.reduce((acc, item) => acc + item.currentMonthSales, 0);
  const totalCurrentMonthBills = customRange
    ? totalAnnualBills
    : outletSummaries.reduce((acc, item) => acc + item.currentMonthBills, 0);

  let bestOutletName: string | null = null;
  let bestOutletSales = 0;
  for (const summary of outletSummaries) {
    if (summary.annualSales > bestOutletSales) {
      bestOutletSales = summary.annualSales;
      bestOutletName = summary.outlet.name;
    }
  }

  return {
    selectedYear,
    currentWibYear: nowWib.year,
    currentWibMonth: nowWib.month,
    availableYears,
    activeStartDate: customRange?.startDateWib ?? null,
    activeEndDate: customRange?.endDateWib ?? null,
    rangeLabel: customRange?.label ?? null,
    rangeDayCount: customRange?.dayCount ?? 0,
    totalOutlets: mappedOutlets.length,
    activeOutletsCount: mappedOutlets.filter((o) => o.isActive).length,
    totalAnnualSales,
    totalAnnualBills,
    totalCurrentMonthSales,
    totalCurrentMonthBills,
    bestOutletName,
    bestOutletSales,
    outlets: outletSummaries,
    monthlyChart,
  };
}
