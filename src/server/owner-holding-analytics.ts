"use server";

import {
  assignDistinctOutletColors,
  mapOutletRowToView,
  type OutletView,
} from "@/lib/outlets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { OrderStatus } from "@/lib/types/database";
import { requireStaffRole } from "@/server/auth";

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
}): Promise<OwnerHoldingAnalyticsData> {
  await requireStaffRole(["owner"]);

  const admin = createSupabaseAdminClient();
  const nowWib = getWibYearMonthFromDate(new Date());

  const requestedYear = params?.year;
  const selectedYear =
    requestedYear &&
    Number.isInteger(requestedYear) &&
    requestedYear >= 2020 &&
    requestedYear <= nowWib.year + 1
      ? requestedYear
      : nowWib.year;

  // Batas UTC untuk 1 Jan 00:00 WIB s/d 1 Jan (year+1) 00:00 WIB,
  // ditambah buffer 3 hari di awal untuk order created_at menjelang pergantian tahun lalu paid_at di Januari.
  const yearStartUtc = new Date(
    Date.UTC(selectedYear, 0, 1, 0, 0, 0) - WIB_OFFSET_MS
  );
  const queryStartUtc = new Date(yearStartUtc.getTime() - 3 * 24 * 60 * 60 * 1000);
  const yearEndUtc = new Date(
    Date.UTC(selectedYear + 1, 0, 1, 0, 0, 0) - WIB_OFFSET_MS
  );

  const [outletsRes, earliestOrderRes, yearOrdersRes] = await Promise.all([
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
    admin
      .from("orders")
      .select("outlet_id, status, total, paid_at, created_at")
      .is("deleted_at", null)
      .gte("created_at", queryStartUtc.toISOString())
      .lt("created_at", yearEndUtc.toISOString()),
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

  // Inisialisasi akumulator per outlet (12 bulan)
  const outletMonthlySales = new Map<string, number[]>();
  const outletMonthlyBills = new Map<string, number[]>();
  for (const outlet of mappedOutlets) {
    outletMonthlySales.set(outlet.id, new Array<number>(12).fill(0));
    outletMonthlyBills.set(outlet.id, new Array<number>(12).fill(0));
  }

  for (const row of yearOrdersRes.data ?? []) {
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
    const wibYm = getWibYearMonthFromIso(effectiveTs);
    if (!wibYm || wibYm.year !== selectedYear) {
      continue;
    }

    const total = Number(row.total ?? 0);
    if (!Number.isFinite(total)) {
      continue;
    }

    salesArr[wibYm.month] = (salesArr[wibYm.month] ?? 0) + Math.round(total);
    billsArr[wibYm.month] = (billsArr[wibYm.month] ?? 0) + 1;
  }

  const targetMonthIndex =
    selectedYear === nowWib.year ? nowWib.month : 11;

  const outletSummaries: HoldingOutletSummary[] = mappedOutlets.map((outlet) => {
    const monthlySeries = outletMonthlySales.get(outlet.id) ?? new Array<number>(12).fill(0);
    const monthlyBills = outletMonthlyBills.get(outlet.id) ?? new Array<number>(12).fill(0);
    const annualSales = monthlySeries.reduce((acc, v) => acc + v, 0);
    const annualBills = monthlyBills.reduce((acc, v) => acc + v, 0);

    return {
      outlet,
      chartColor: colorMap.get(outlet.id) ?? "#0284C7",
      annualSales,
      annualBills,
      currentMonthSales: monthlySeries[targetMonthIndex] ?? 0,
      currentMonthBills: monthlyBills[targetMonthIndex] ?? 0,
      monthlySeries,
      monthlyBills,
    };
  });

  const monthlyChart: HoldingMonthlyBucket[] = MONTH_SHORT_LABELS_ID.map(
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
  const totalCurrentMonthSales = outletSummaries.reduce(
    (acc, item) => acc + item.currentMonthSales,
    0
  );
  const totalCurrentMonthBills = outletSummaries.reduce(
    (acc, item) => acc + item.currentMonthBills,
    0
  );

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
