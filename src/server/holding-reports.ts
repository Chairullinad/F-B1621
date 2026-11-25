"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { formatDateTimeWIB } from "@/lib/datetime";
import { formatRupiah, roundRupiah } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  DailyReportSections,
  HoldingSettingsRow,
  InstantNotificationEvents,
} from "@/lib/types/database";
import { createZipBuffer, type ZipEntryInput } from "@/lib/zip";
import { requireStaffRole, type ActionResult } from "@/server/auth";
import { sendTransactionalEmail } from "@/server/owner-notifications";

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;

const DEFAULT_DAILY_REPORT_SECTIONS: DailyReportSections = {
  sales: true,
  profit_loss: true,
  cash_flow: true,
  tax: true,
  journals: true,
  inventory: true,
  audit: true,
};

const DEFAULT_INSTANT_EVENTS: InstantNotificationEvents = {
  refund: true,
  paid_cancellation: true,
  discount: true,
  price_or_setting_change: true,
};

export interface HoldingOutletOption {
  id: string;
  name: string;
  isActive: boolean;
  notificationEmail: string | null;
}

export interface DailyOutletFinancialSummary {
  outletId: string;
  outletName: string;
  dateWib: string;
  paidOrdersCount: number;
  cancelledOrdersCount: number;
  pendingOrdersCount: number;
  grossSales: number;
  totalDiscount: number;
  totalRefund: number;
  netSales: number;
  qrisSales: number;
  cashSales: number;
  totalService: number;
  totalTax: number;
  cogsAmount: number;
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  cashInflow: number;
  cashOutflow: number;
  netCashFlow: number;
  journalCount: number;
  inventoryAssetValue: number;
  supplierPayable: number;
  lowStockCount: number;
  wasteAmount: number;
  purchaseOrderAmount: number;
  auditLogsCount: number;
}

export interface DailyHoldingReportPreview {
  dateWib: string;
  generatedAtWib: string;
  outlets: DailyOutletFinancialSummary[];
  totals: {
    paidOrdersCount: number;
    cancelledOrdersCount: number;
    grossSales: number;
    totalDiscount: number;
    totalRefund: number;
    netSales: number;
    qrisSales: number;
    cashSales: number;
    totalService: number;
    totalTax: number;
    cogsAmount: number;
    grossProfit: number;
    operatingExpenses: number;
    netProfit: number;
    cashInflow: number;
    cashOutflow: number;
    netCashFlow: number;
    journalCount: number;
    inventoryAssetValue: number;
    supplierPayable: number;
    wasteAmount: number;
    auditLogsCount: number;
  };
}

export interface HoldingSettingsPageData {
  settings: HoldingSettingsRow;
  outlets: HoldingOutletOption[];
  preview: DailyHoldingReportPreview;
  migrationMissing: boolean;
}

export async function getCurrentWibDateTime(): Promise<{
  dateStr: string;
  timeStr: string;
}> {
  const wib = new Date(Date.now() + WIB_OFFSET_MS);
  const y = wib.getUTCFullYear();
  const m = String(wib.getUTCMonth() + 1).padStart(2, "0");
  const d = String(wib.getUTCDate()).padStart(2, "0");
  const hh = String(wib.getUTCHours()).padStart(2, "0");
  const mm = String(wib.getUTCMinutes()).padStart(2, "0");
  return {
    dateStr: `${y}-${m}-${d}`,
    timeStr: `${hh}:${mm}`,
  };
}

function normalizeDateWib(raw?: string): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parts = trimmed.split("-");
  const y = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);
  const d = Number(parts[2] ?? 0);
  const check = new Date(Date.UTC(y, m - 1, d));
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }
  return trimmed;
}

function getWibDayUtcBounds(dateWib: string): {
  startIso: string;
  endIso: string;
} {
  const parts = dateWib.split("-");
  const y = Number(parts[0] ?? 2026);
  const m = Number(parts[1] ?? 1);
  const d = Number(parts[2] ?? 1);
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0, 0) - WIB_OFFSET_MS;
  const endUtcMs = Date.UTC(y, m - 1, d, 23, 59, 59, 999) - WIB_OFFSET_MS;
  return {
    startIso: new Date(startUtcMs).toISOString(),
    endIso: new Date(endUtcMs).toISOString(),
  };
}

function csvCell(value: unknown): string {
  const str = String(value ?? "");
  return `"${str.replace(/"/g, '""')}"`;
}

function buildCsv(
  headers: ReadonlyArray<string>,
  rows: ReadonlyArray<ReadonlyArray<unknown>>
): string {
  const bom = "\uFEFF";
  const lines = [
    headers.map(csvCell).join(","),
    ...rows.map((r) => r.map(csvCell).join(",")),
  ];
  return bom + lines.join("\r\n");
}

function slugifyOutletName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "outlet"
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function sanitizeDailySections(raw: unknown): DailyReportSections {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_DAILY_REPORT_SECTIONS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    sales: obj.sales !== false,
    profit_loss: obj.profit_loss !== false,
    cash_flow: obj.cash_flow !== false,
    tax: obj.tax !== false,
    journals: obj.journals !== false,
    inventory: obj.inventory !== false,
    audit: obj.audit !== false,
  };
}

function sanitizeInstantEvents(raw: unknown): InstantNotificationEvents {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { ...DEFAULT_INSTANT_EVENTS };
  }
  const obj = raw as Record<string, unknown>;
  return {
    refund: obj.refund !== false,
    paid_cancellation: obj.paid_cancellation !== false,
    discount: obj.discount !== false,
    price_or_setting_change: obj.price_or_setting_change !== false,
  };
}

function sanitizeOutletIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.length > 0);
}

async function fetchHoldingSettingsInternal(): Promise<{
  settings: HoldingSettingsRow;
  outlets: HoldingOutletOption[];
  migrationMissing: boolean;
}> {
  const admin = createSupabaseAdminClient();

  const [outletsRes, notifRes, holdingRes] = await Promise.all([
    admin
      .from("outlets")
      .select("id, name, is_active")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin.from("notification_settings").select("outlet_id, owner_email"),
    admin.from("holding_settings").select("*").eq("id", "default").maybeSingle(),
  ]);

  const notifEmailMap = new Map<string, string | null>();
  for (const row of notifRes.data ?? []) {
    notifEmailMap.set(
      String(row.outlet_id),
      typeof row.owner_email === "string" && row.owner_email.trim()
        ? row.owner_email.trim()
        : null
    );
  }

  const outlets: HoldingOutletOption[] = (outletsRes.data ?? []).map((o) => ({
    id: String(o.id),
    name: String(o.name ?? "Kios"),
    isActive: o.is_active !== false,
    notificationEmail: notifEmailMap.get(String(o.id)) ?? null,
  }));

  const firstKnownEmail =
    outlets.find((o) => Boolean(o.notificationEmail))?.notificationEmail ?? null;

  const migrationMissing = Boolean(
    holdingRes.error &&
      (holdingRes.error.message.includes("holding_settings") ||
        holdingRes.error.message.includes("schema cache"))
  );

  const raw = holdingRes.data as Record<string, unknown> | null;
  const parsedOutletIds = sanitizeOutletIds(raw?.daily_report_outlet_ids);

  const settings: HoldingSettingsRow = {
    id: "default",
    owner_email:
      typeof raw?.owner_email === "string" && raw.owner_email.trim()
        ? raw.owner_email.trim()
        : firstKnownEmail,
    daily_report_enabled: Boolean(raw?.daily_report_enabled ?? false),
    daily_report_time_wib:
      typeof raw?.daily_report_time_wib === "string" &&
      /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(raw.daily_report_time_wib)
        ? raw.daily_report_time_wib
        : "23:55",
    daily_report_outlet_ids:
      parsedOutletIds.length > 0
        ? parsedOutletIds
        : outlets.map((o) => o.id),
    daily_report_sections: sanitizeDailySections(raw?.daily_report_sections),
    last_daily_report_date:
      typeof raw?.last_daily_report_date === "string"
        ? raw.last_daily_report_date
        : null,
    last_daily_report_sent_at:
      typeof raw?.last_daily_report_sent_at === "string"
        ? raw.last_daily_report_sent_at
        : null,
    monthly_report_enabled: Boolean(raw?.monthly_report_enabled ?? false),
    instant_events: sanitizeInstantEvents(raw?.instant_events),
    created_at:
      typeof raw?.created_at === "string"
        ? raw.created_at
        : new Date().toISOString(),
    updated_at:
      typeof raw?.updated_at === "string"
        ? raw.updated_at
        : new Date().toISOString(),
  };

  return { settings, outlets, migrationMissing };
}

export async function buildDailyHoldingZipAndSummary(params: {
  dateWib?: string;
  outletIds?: ReadonlyArray<string>;
  sections?: DailyReportSections;
}): Promise<{
  preview: DailyHoldingReportPreview;
  zipBuffer: Buffer;
  zipFilename: string;
  summaryHtml: string;
}> {
  const admin = createSupabaseAdminClient();
  const currentWib = await getCurrentWibDateTime();
  const dateWib = normalizeDateWib(params.dateWib) ?? currentWib.dateStr;
  const { startIso, endIso } = getWibDayUtcBounds(dateWib);
  const sections = params.sections ?? DEFAULT_DAILY_REPORT_SECTIONS;

  const outletsRes = await admin
    .from("outlets")
    .select("id, name, is_active")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const allOutlets = (outletsRes.data ?? []).map((o) => ({
    id: String(o.id),
    name: String(o.name ?? "Kios"),
  }));

  const targetOutlets =
    params.outletIds && params.outletIds.length > 0
      ? allOutlets.filter((o) => params.outletIds?.includes(o.id))
      : allOutlets;

  const targetIds = targetOutlets.map((o) => o.id);

  const [
    ordersRes,
    refundsRes,
    journalsRes,
    ingredientsRes,
    suppliersRes,
    wasteRes,
    poRes,
    auditsRes,
  ] =
    targetIds.length === 0
      ? [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ]
      : await Promise.all([
          admin
            .from("orders")
            .select(
              "id, outlet_id, order_no, source, order_type, payment_choice, status, subtotal, discount, service_amount, tax_amount, total, cogs_amount, created_at, paid_at, cancel_reason"
            )
            .in("outlet_id", targetIds)
            .is("deleted_at", null)
            .gte("created_at", startIso)
            .lte("created_at", endIso)
            .order("created_at", { ascending: true }),
          admin
            .from("refunds")
            .select(
              "id, order_id, amount, reason_category, reason, created_at, orders!inner(outlet_id, order_no)"
            )
            .in("orders.outlet_id", targetIds)
            .gte("created_at", startIso)
            .lte("created_at", endIso),
          admin
            .from("accounting_journals")
            .select(
              "id, outlet_id, journal_no, entry_date, description, debit_account, credit_account, amount, source_type, created_at"
            )
            .in("outlet_id", targetIds)
            .or(
              `entry_date.eq.${dateWib},and(created_at.gte.${startIso},created_at.lte.${endIso})`
            )
            .order("created_at", { ascending: true }),
          admin
            .from("ingredients")
            .select(
              "id, outlet_id, name, category, unit, current_stock, min_stock, unit_cost"
            )
            .in("outlet_id", targetIds)
            .is("deleted_at", null)
            .order("name", { ascending: true }),
          admin
            .from("suppliers")
            .select("id, outlet_id, name, payable_balance")
            .in("outlet_id", targetIds)
            .is("deleted_at", null),
          admin
            .from("waste_logs")
            .select(
              "id, outlet_id, quantity, cost_amount, reason, created_at"
            )
            .in("outlet_id", targetIds)
            .gte("created_at", startIso)
            .lte("created_at", endIso),
          admin
            .from("purchase_orders")
            .select(
              "id, outlet_id, po_number, status, total_amount, paid_amount, created_at"
            )
            .in("outlet_id", targetIds)
            .gte("created_at", startIso)
            .lte("created_at", endIso),
          admin
            .from("audit_logs")
            .select("id, outlet_id, role, action, entity, entity_id, reason, created_at")
            .in("outlet_id", targetIds)
            .gte("created_at", startIso)
            .lte("created_at", endIso)
            .order("created_at", { ascending: true })
            .limit(1000),
        ]);

  type OrderItemRow = {
    id: string;
    outlet_id: string;
    order_no: string;
    source: string;
    order_type: string;
    payment_choice: string;
    status: string;
    subtotal: number;
    discount: number;
    service_amount: number | null;
    tax_amount: number | null;
    total: number;
    cogs_amount: number | null;
    created_at: string;
    paid_at: string | null;
    cancel_reason: string | null;
  };
  type RefundRow = {
    id: string;
    order_id: string;
    amount: number;
    reason_category: string;
    reason: string;
    created_at: string;
    orders: { outlet_id: string; order_no: string } | Array<{ outlet_id: string; order_no: string }>;
  };
  type JournalRow = {
    id: string;
    outlet_id: string;
    journal_no: string;
    entry_date: string;
    description: string;
    debit_account: string;
    credit_account: string;
    amount: number;
    source_type: string;
    created_at: string;
  };
  type IngredientRow = {
    id: string;
    outlet_id: string;
    name: string;
    category: string;
    unit: string;
    current_stock: number;
    min_stock: number;
    unit_cost: number;
  };
  type SupplierRow = {
    id: string;
    outlet_id: string;
    name: string;
    payable_balance: number;
  };
  type WasteRow = {
    id: string;
    outlet_id: string;
    quantity: number;
    cost_amount: number;
    reason: string;
    created_at: string;
  };
  type PoRow = {
    id: string;
    outlet_id: string;
    po_number: string;
    status: string;
    total_amount: number;
    paid_amount: number;
    created_at: string;
  };
  type AuditRow = {
    id: string;
    outlet_id: string;
    role: string;
    action: string;
    entity: string;
    entity_id: string;
    reason: string | null;
    created_at: string;
  };

  const allOrders = (ordersRes.data ?? []) as OrderItemRow[];
  const allRefunds = (refundsRes.data ?? []) as RefundRow[];
  const allJournals = (journalsRes.data ?? []) as JournalRow[];
  const allIngredients = (ingredientsRes.data ?? []) as IngredientRow[];
  const allSuppliers = (suppliersRes.data ?? []) as SupplierRow[];
  const allWastes = (wasteRes.data ?? []) as WasteRow[];
  const allPos = (poRes.data ?? []) as PoRow[];
  const allAudits = (auditsRes.data ?? []) as AuditRow[];

  const summaries: DailyOutletFinancialSummary[] = [];
  const zipEntries: ZipEntryInput[] = [];
  const usedFolderSlugs = new Set<string>();

  for (const outlet of targetOutlets) {
    let folderSlug = slugifyOutletName(outlet.name);
    if (usedFolderSlugs.has(folderSlug)) {
      folderSlug = `${folderSlug}-${outlet.id.slice(0, 6)}`;
    }
    usedFolderSlugs.add(folderSlug);

    const oOrders = allOrders.filter((o) => o.outlet_id === outlet.id);
    const oRefunds = allRefunds.filter((r) => {
      const rel = Array.isArray(r.orders) ? r.orders[0] : r.orders;
      return rel?.outlet_id === outlet.id;
    });
    const oJournals = allJournals.filter((j) => j.outlet_id === outlet.id);
    const oIngredients = allIngredients.filter((i) => i.outlet_id === outlet.id);
    const oSuppliers = allSuppliers.filter((s) => s.outlet_id === outlet.id);
    const oWastes = allWastes.filter((w) => w.outlet_id === outlet.id);
    const oPos = allPos.filter((p) => p.outlet_id === outlet.id);
    const oAudits = allAudits.filter((a) => a.outlet_id === outlet.id);

    let paidOrdersCount = 0;
    let cancelledOrdersCount = 0;
    let pendingOrdersCount = 0;
    let grossSales = 0;
    let totalDiscount = 0;
    let qrisSales = 0;
    let cashSales = 0;
    let totalService = 0;
    let totalTax = 0;
    let orderCogsSum = 0;

    for (const ord of oOrders) {
      if (ord.status === "cancelled") {
        cancelledOrdersCount += 1;
      } else if (ord.status === "pending") {
        pendingOrdersCount += 1;
      }
      if (
        ord.paid_at !== null ||
        ["paid", "ready", "served"].includes(ord.status)
      ) {
        paidOrdersCount += 1;
        const tot = Number(ord.total ?? 0);
        grossSales += tot;
        totalDiscount += Number(ord.discount ?? 0);
        totalService += Number(ord.service_amount ?? 0);
        totalTax += Number(ord.tax_amount ?? 0);
        orderCogsSum += Number(ord.cogs_amount ?? 0);
        if (ord.payment_choice === "qris") {
          qrisSales += tot;
        } else {
          cashSales += tot;
        }
      }
    }

    const totalRefund = oRefunds.reduce((s, r) => s + Number(r.amount ?? 0), 0);
    const netSales = Math.max(0, grossSales - totalRefund);

    const journalCogs = oJournals
      .filter((j) => j.source_type === "order_cogs")
      .reduce((s, j) => s + Number(j.amount ?? 0), 0);
    const cogsAmount = journalCogs > 0 ? journalCogs : orderCogsSum;
    const grossProfit = netSales - cogsAmount;

    const expenseSources = new Set([
      "expense_salary",
      "expense_rent",
      "expense_utility",
      "expense_other",
      "waste",
    ]);
    const journalExpenses = oJournals
      .filter(
        (j) =>
          expenseSources.has(j.source_type) ||
          (j.source_type === "opname" &&
            j.debit_account.toLowerCase().includes("beban"))
      )
      .reduce((s, j) => s + Number(j.amount ?? 0), 0);
    const wasteAmount = oWastes.reduce(
      (s, w) => s + Number(w.cost_amount ?? 0),
      0
    );
    const operatingExpenses = Math.max(journalExpenses, wasteAmount);
    const netProfit = grossProfit - operatingExpenses;

    const ownerCapitalInflow = oJournals
      .filter((j) => j.source_type === "owner_capital")
      .reduce((s, j) => s + Number(j.amount ?? 0), 0);
    const poCashPaid = oPos.reduce(
      (s, p) => s + Number(p.paid_amount ?? 0),
      0
    );
    const poJournalPaid = oJournals
      .filter((j) => j.source_type === "po_payment")
      .reduce((s, j) => s + Number(j.amount ?? 0), 0);
    const assetPurchases = oJournals
      .filter((j) => j.source_type === "asset_purchase")
      .reduce((s, j) => s + Number(j.amount ?? 0), 0);

    const cashInflow = netSales + ownerCapitalInflow;
    const cashOutflow =
      Math.max(poCashPaid, poJournalPaid) + operatingExpenses + assetPurchases;
    const netCashFlow = cashInflow - cashOutflow;

    const inventoryAssetValue = roundRupiah(
      oIngredients.reduce(
        (s, i) => s + Number(i.current_stock) * Number(i.unit_cost),
        0
      )
    );
    const supplierPayable = oSuppliers.reduce(
      (s, sup) => s + Number(sup.payable_balance ?? 0),
      0
    );
    const lowStockCount = oIngredients.filter(
      (i) => Number(i.current_stock) <= Number(i.min_stock)
    ).length;
    const purchaseOrderAmount = oPos.reduce(
      (s, p) => s + Number(p.total_amount ?? 0),
      0
    );

    const summary: DailyOutletFinancialSummary = {
      outletId: outlet.id,
      outletName: outlet.name,
      dateWib,
      paidOrdersCount,
      cancelledOrdersCount,
      pendingOrdersCount,
      grossSales,
      totalDiscount,
      totalRefund,
      netSales,
      qrisSales,
      cashSales,
      totalService,
      totalTax,
      cogsAmount,
      grossProfit,
      operatingExpenses,
      netProfit,
      cashInflow,
      cashOutflow,
      netCashFlow,
      journalCount: oJournals.length,
      inventoryAssetValue,
      supplierPayable,
      lowStockCount,
      wasteAmount,
      purchaseOrderAmount,
      auditLogsCount: oAudits.length,
    };
    summaries.push(summary);

    // Build per-outlet CSV files inside ZIP based on checked sections
    zipEntries.push({
      name: `${folderSlug}/01_ringkasan_keuangan_dan_akuntansi_${dateWib}.csv`,
      content: buildCsv(
        ["Komponen", "Nilai (Rp / Qty)"],
        [
          ["Nama Outlet", outlet.name],
          ["Tanggal Laporan (WIB)", dateWib],
          ["Transaksi Lunas", paidOrdersCount],
          ["Order Dibatalkan", cancelledOrdersCount],
          ["Order Pending", pendingOrdersCount],
          ...(sections.sales
            ? [
                ["Penjualan Kotor (Gross Sales)", grossSales],
                ["Penjualan QRIS", qrisSales],
                ["Penjualan Tunai", cashSales],
                ["Total Diskon", totalDiscount],
                ["Total Refund", totalRefund],
                ["Penjualan Bersih (Net Sales)", netSales],
              ]
            : []),
          ...(sections.tax
            ? [
                ["Service Charge Terkumpul", totalService],
                ["Pajak (PPN/PB1) Terkumpul", totalTax],
              ]
            : []),
          ...(sections.profit_loss
            ? [
                ["HPP Bahan Baku (BOM)", cogsAmount],
                ["Laba Kotor (Gross Profit)", grossProfit],
                ["Beban Operasional & Waste", operatingExpenses],
                ["Laba Bersih Harian (Net Profit)", netProfit],
              ]
            : []),
          ...(sections.cash_flow
            ? [
                ["Kas Masuk Harian", cashInflow],
                ["Kas Keluar Harian", cashOutflow],
                ["Arus Kas Bersih Harian", netCashFlow],
              ]
            : []),
          ...(sections.inventory
            ? [
                ["Nilai Aset Stok Bahan Baku", inventoryAssetValue],
                ["Item Stok Menipis / Habis", lowStockCount],
                ["Total Hutang Supplier", supplierPayable],
                ["Total Nilai Waste Hari Ini", wasteAmount],
                ["Total Nilai Purchase Order Hari Ini", purchaseOrderAmount],
              ]
            : []),
          ...(sections.journals
            ? [["Jumlah Entri Jurnal Umum Hari Ini", oJournals.length]]
            : []),
          ...(sections.audit
            ? [["Jumlah Aktivitas Jejak Audit Hari Ini", oAudits.length]]
            : []),
        ]
      ),
    });

    if (sections.sales) {
      zipEntries.push({
        name: `${folderSlug}/02_transaksi_dan_refund_${dateWib}.csv`,
        content: buildCsv(
          [
            "No. Order",
            "Waktu Buat (WIB)",
            "Sumber",
            "Tipe",
            "Metode Bayar",
            "Status",
            "Subtotal",
            "Diskon",
            "Service",
            "Pajak",
            "Total",
            "HPP",
            "Alasan Batal",
          ],
          oOrders.map((o) => [
            o.order_no,
            formatDateTimeWIB(o.created_at),
            o.source,
            o.order_type,
            o.payment_choice,
            o.status,
            o.subtotal,
            o.discount,
            o.service_amount ?? 0,
            o.tax_amount ?? 0,
            o.total,
            o.cogs_amount ?? 0,
            o.cancel_reason ?? "",
          ])
        ),
      });
    }

    if (sections.journals) {
      zipEntries.push({
        name: `${folderSlug}/03_jurnal_umum_${dateWib}.csv`,
        content: buildCsv(
          [
            "No. Jurnal",
            "Tanggal",
            "Sumber",
            "Keterangan",
            "Akun Debit",
            "Akun Kredit",
            "Nominal (Rp)",
            "Waktu Catat (WIB)",
          ],
          oJournals.map((j) => [
            j.journal_no,
            j.entry_date,
            j.source_type,
            j.description,
            j.debit_account,
            j.credit_account,
            j.amount,
            formatDateTimeWIB(j.created_at),
          ])
        ),
      });
    }

    if (sections.inventory) {
      zipEntries.push({
        name: `${folderSlug}/04_posisi_stok_bahan_${dateWib}.csv`,
        content: buildCsv(
          [
            "Nama Bahan",
            "Kategori",
            "Satuan",
            "Stok Saat Ini",
            "Stok Minimum",
            "Harga Satuan (Rp)",
            "Nilai Aset (Rp)",
          ],
          oIngredients.map((ing) => [
            ing.name,
            ing.category,
            ing.unit,
            ing.current_stock,
            ing.min_stock,
            ing.unit_cost,
            roundRupiah(Number(ing.current_stock) * Number(ing.unit_cost)),
          ])
        ),
      });
    }

    if (sections.audit) {
      zipEntries.push({
        name: `${folderSlug}/05_jejak_audit_${dateWib}.csv`,
        content: buildCsv(
          ["Waktu (WIB)", "Role", "Aksi", "Entitas", "ID Entitas", "Alasan"],
          oAudits.map((a) => [
            formatDateTimeWIB(a.created_at),
            a.role,
            a.action,
            a.entity,
            a.entity_id,
            a.reason ?? "",
          ])
        ),
      });
    }
  }

  const totals = summaries.reduce(
    (acc, item) => ({
      paidOrdersCount: acc.paidOrdersCount + item.paidOrdersCount,
      cancelledOrdersCount:
        acc.cancelledOrdersCount + item.cancelledOrdersCount,
      grossSales: acc.grossSales + item.grossSales,
      totalDiscount: acc.totalDiscount + item.totalDiscount,
      totalRefund: acc.totalRefund + item.totalRefund,
      netSales: acc.netSales + item.netSales,
      qrisSales: acc.qrisSales + item.qrisSales,
      cashSales: acc.cashSales + item.cashSales,
      totalService: acc.totalService + item.totalService,
      totalTax: acc.totalTax + item.totalTax,
      cogsAmount: acc.cogsAmount + item.cogsAmount,
      grossProfit: acc.grossProfit + item.grossProfit,
      operatingExpenses: acc.operatingExpenses + item.operatingExpenses,
      netProfit: acc.netProfit + item.netProfit,
      cashInflow: acc.cashInflow + item.cashInflow,
      cashOutflow: acc.cashOutflow + item.cashOutflow,
      netCashFlow: acc.netCashFlow + item.netCashFlow,
      journalCount: acc.journalCount + item.journalCount,
      inventoryAssetValue: acc.inventoryAssetValue + item.inventoryAssetValue,
      supplierPayable: acc.supplierPayable + item.supplierPayable,
      wasteAmount: acc.wasteAmount + item.wasteAmount,
      auditLogsCount: acc.auditLogsCount + item.auditLogsCount,
    }),
    {
      paidOrdersCount: 0,
      cancelledOrdersCount: 0,
      grossSales: 0,
      totalDiscount: 0,
      totalRefund: 0,
      netSales: 0,
      qrisSales: 0,
      cashSales: 0,
      totalService: 0,
      totalTax: 0,
      cogsAmount: 0,
      grossProfit: 0,
      operatingExpenses: 0,
      netProfit: 0,
      cashInflow: 0,
      cashOutflow: 0,
      netCashFlow: 0,
      journalCount: 0,
      inventoryAssetValue: 0,
      supplierPayable: 0,
      wasteAmount: 0,
      auditLogsCount: 0,
    }
  );

  // Konsolidasi CSV di root ZIP
  zipEntries.unshift({
    name: `00_RINGKASAN_KONSOLIDASI_${dateWib}.csv`,
    content: buildCsv(
      [
        "Outlet",
        "Transaksi Lunas",
        "Batal",
        "Penjualan Kotor",
        "QRIS",
        "Tunai",
        "Diskon",
        "Refund",
        "Penjualan Bersih",
        "Service",
        "Pajak",
        "HPP",
        "Laba Kotor",
        "Beban Ops",
        "Laba Bersih",
        "Kas Masuk",
        "Kas Keluar",
        "Arus Kas Bersih",
        "Jurnal",
        "Nilai Stok",
        "Hutang Supplier",
        "Audit Log",
      ],
      [
        ...summaries.map((s) => [
          s.outletName,
          s.paidOrdersCount,
          s.cancelledOrdersCount,
          s.grossSales,
          s.qrisSales,
          s.cashSales,
          s.totalDiscount,
          s.totalRefund,
          s.netSales,
          s.totalService,
          s.totalTax,
          s.cogsAmount,
          s.grossProfit,
          s.operatingExpenses,
          s.netProfit,
          s.cashInflow,
          s.cashOutflow,
          s.netCashFlow,
          s.journalCount,
          s.inventoryAssetValue,
          s.supplierPayable,
          s.auditLogsCount,
        ]),
        [
          "TOTAL KONSOLIDASI",
          totals.paidOrdersCount,
          totals.cancelledOrdersCount,
          totals.grossSales,
          totals.qrisSales,
          totals.cashSales,
          totals.totalDiscount,
          totals.totalRefund,
          totals.netSales,
          totals.totalService,
          totals.totalTax,
          totals.cogsAmount,
          totals.grossProfit,
          totals.operatingExpenses,
          totals.netProfit,
          totals.cashInflow,
          totals.cashOutflow,
          totals.netCashFlow,
          totals.journalCount,
          totals.inventoryAssetValue,
          totals.supplierPayable,
          totals.auditLogsCount,
        ],
      ]
    ),
  });

  const generatedAtWib = formatDateTimeWIB(new Date());

  const rowsHtml = summaries
    .map(
      (s) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${escapeHtml(s.outletName)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${s.paidOrdersCount}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatRupiah(s.netSales)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatRupiah(s.cogsAmount)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:bold;">${formatRupiah(s.netProfit)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${formatRupiah(s.netCashFlow)}</td>
        <td style="padding:8px;border-bottom:1px solid #e2e8f0;text-align:right;">${s.journalCount}</td>
      </tr>
    `
    )
    .join("");

  const summaryHtml = `
    <div style="font-family:sans-serif;max-width:740px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;padding:24px;color:#0f172a;">
      <h2 style="margin-top:0;color:#0f172a;">Laporan Keuangan &amp; Akuntansi Harian (Backup ZIP) — ${escapeHtml(dateWib)}</h2>
      <p style="font-size:13px;color:#475569;">
        Dicetak otomatis pada <strong>${escapeHtml(generatedAtWib)}</strong> untuk <strong>${summaries.length} outlet</strong>.
        Rincian lengkap (Transaksi, Jurnal Umum, Arus Kas, Laba Rugi, Pajak, Stok Bahan &amp; Jejak Audit) terlampir dalam arsip <strong>.zip</strong>.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:13px;margin-top:14px;">
        <thead>
          <tr style="background:#f8fafc;border-bottom:2px solid #cbd5e1;text-align:left;">
            <th style="padding:8px;">Outlet</th>
            <th style="padding:8px;text-align:right;">Bill</th>
            <th style="padding:8px;text-align:right;">Penjualan Bersih</th>
            <th style="padding:8px;text-align:right;">HPP</th>
            <th style="padding:8px;text-align:right;">Laba Bersih</th>
            <th style="padding:8px;text-align:right;">Arus Kas Bersih</th>
            <th style="padding:8px;text-align:right;">Jurnal</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
          <tr style="background:#f1f5f9;font-weight:bold;">
            <td style="padding:9px 8px;">TOTAL KONSOLIDASI</td>
            <td style="padding:9px 8px;text-align:right;">${totals.paidOrdersCount}</td>
            <td style="padding:9px 8px;text-align:right;">${formatRupiah(totals.netSales)}</td>
            <td style="padding:9px 8px;text-align:right;">${formatRupiah(totals.cogsAmount)}</td>
            <td style="padding:9px 8px;text-align:right;color:#047857;">${formatRupiah(totals.netProfit)}</td>
            <td style="padding:9px 8px;text-align:right;">${formatRupiah(totals.netCashFlow)}</td>
            <td style="padding:9px 8px;text-align:right;">${totals.journalCount}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;

  zipEntries.push({
    name: `LAPORAN_HARIAN_${dateWib}.html`,
    content: summaryHtml,
  });

  const zipBuffer = createZipBuffer(zipEntries);
  const zipFilename = `fnb1621_backup_harian_${dateWib}.zip`;

  return {
    preview: {
      dateWib,
      generatedAtWib,
      outlets: summaries,
      totals,
    },
    zipBuffer,
    zipFilename,
    summaryHtml,
  };
}

export async function getHoldingSettingsPageData(
  requestedDateWib?: string
): Promise<HoldingSettingsPageData> {
  await requireStaffRole(["owner"], "pengaturan");
  const { settings, outlets, migrationMissing } =
    await fetchHoldingSettingsInternal();

  const previewBundle = await buildDailyHoldingZipAndSummary({
    dateWib: requestedDateWib,
    outletIds:
      settings.daily_report_outlet_ids.length > 0
        ? settings.daily_report_outlet_ids
        : outlets.map((o) => o.id),
    sections: settings.daily_report_sections,
  });

  return {
    settings,
    outlets,
    preview: previewBundle.preview,
    migrationMissing,
  };
}

export async function getDailyEmailTemplatePreview(
  requestedDateWib?: string
): Promise<DailyHoldingReportPreview> {
  await requireStaffRole(["owner"], "keuangan");
  const { settings, outlets } = await fetchHoldingSettingsInternal();

  const previewBundle = await buildDailyHoldingZipAndSummary({
    dateWib: requestedDateWib,
    outletIds:
      settings.daily_report_outlet_ids.length > 0
        ? settings.daily_report_outlet_ids
        : outlets.map((o) => o.id),
    sections: settings.daily_report_sections,
  });

  return previewBundle.preview;
}

const saveHoldingSettingsSchema = z.object({
  ownerEmail: z
    .string()
    .trim()
    .email("Format email Owner tidak valid.")
    .or(z.literal("")),
  dailyReportEnabled: z.boolean(),
  dailyReportTimeWib: z
    .string()
    .trim()
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, "Format jam harus HH:MM (WIB)."),
  dailyReportOutletIds: z.array(z.string().uuid()).default([]),
  dailyReportSections: z.object({
    sales: z.boolean(),
    profit_loss: z.boolean(),
    cash_flow: z.boolean(),
    tax: z.boolean(),
    journals: z.boolean(),
    inventory: z.boolean(),
    audit: z.boolean(),
  }),
  monthlyReportEnabled: z.boolean(),
  instantEvents: z.object({
    refund: z.boolean(),
    paid_cancellation: z.boolean(),
    discount: z.boolean(),
    price_or_setting_change: z.boolean(),
  }),
  syncToOutlets: z.boolean().default(true),
});

export async function updateHoldingSettingsAction(
  rawInput: z.input<typeof saveHoldingSettingsSchema>
): Promise<ActionResult> {
  const owner = await requireStaffRole(["owner"], "pengaturan");
  const parsed = saveHoldingSettingsSchema.safeParse(rawInput);

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Pengaturan holding tidak valid.",
    };
  }

  const data = parsed.data;
  if (data.dailyReportEnabled && !data.ownerEmail) {
    return {
      ok: false,
      message:
        "Isi Alamat Email Owner terlebih dahulu sebelum menyalakan laporan harian otomatis.",
    };
  }
  if (data.dailyReportEnabled && data.dailyReportOutletIds.length === 0) {
    return {
      ok: false,
      message:
        "Centang minimal 1 outlet yang akan disertakan dalam email laporan harian.",
    };
  }

  const admin = createSupabaseAdminClient();
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "holding-settings";

  await admin.rpc("set_audit_context", {
    p_user_id: owner.userId,
    p_role: owner.role,
    p_device: device,
    p_ip: ip,
    p_reason: "Pembaruan pengaturan notifikasi & laporan harian Holding Owner",
  });

  const { error: upsertErr } = await admin.from("holding_settings").upsert(
    {
      id: "default",
      owner_email: data.ownerEmail || null,
      daily_report_enabled: data.dailyReportEnabled,
      daily_report_time_wib: data.dailyReportTimeWib,
      daily_report_outlet_ids: data.dailyReportOutletIds,
      daily_report_sections: data.dailyReportSections,
      monthly_report_enabled: data.monthlyReportEnabled,
      instant_events: data.instantEvents,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "id" }
  );

  if (upsertErr) {
    if (
      upsertErr.message.includes("holding_settings") ||
      upsertErr.message.includes("schema cache")
    ) {
      return {
        ok: false,
        message:
          "Tabel holding_settings belum tersedia di database. Jalankan migrasi 0010 di Supabase SQL Editor terlebih dahulu.",
      };
    }
    return {
      ok: false,
      message: `Gagal menyimpan pengaturan: ${upsertErr.message}`,
    };
  }

  if (data.syncToOutlets) {
    const { data: outlets } = await admin
      .from("outlets")
      .select("id")
      .is("deleted_at", null);

    for (const o of outlets ?? []) {
      await admin.from("notification_settings").upsert(
        {
          outlet_id: String(o.id),
          owner_email: data.ownerEmail || null,
          monthly_report_enabled: data.monthlyReportEnabled,
          instant_events: data.instantEvents,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "outlet_id" }
      );
    }
  }

  revalidatePath("/dashboard/pengaturan-utama");
  revalidatePath("/dashboard/pengaturan");
  return {
    ok: true,
    message:
      "Pengaturan notifikasi Owner & jadwal report harian ZIP berhasil disimpan.",
  };
}

export async function dispatchDailyHoldingZipReport(params?: {
  dateWib?: string;
  forceSend?: boolean;
}): Promise<{
  ok: boolean;
  skipped?: boolean;
  message: string;
  dateWib: string;
  outletsCount: number;
}> {
  const { settings, outlets } = await fetchHoldingSettingsInternal();
  const { dateStr: todayWib, timeStr: nowTimeWib } =
    await getCurrentWibDateTime();
  const targetDate = normalizeDateWib(params?.dateWib) ?? todayWib;

  if (!params?.forceSend) {
    if (!settings.daily_report_enabled) {
      return {
        ok: true,
        skipped: true,
        message: "Laporan harian otomatis sedang nonaktif.",
        dateWib: targetDate,
        outletsCount: 0,
      };
    }
    if (nowTimeWib < settings.daily_report_time_wib) {
      return {
        ok: true,
        skipped: true,
        message: `Belum mencapai jam kirim (${settings.daily_report_time_wib} WIB; saat ini ${nowTimeWib} WIB).`,
        dateWib: targetDate,
        outletsCount: 0,
      };
    }
    if (settings.last_daily_report_date === targetDate) {
      return {
        ok: true,
        skipped: true,
        message: `Laporan harian untuk ${targetDate} sudah terkirim hari ini.`,
        dateWib: targetDate,
        outletsCount: 0,
      };
    }
  }

  const ownerEmail = settings.owner_email?.trim() ?? "";
  if (!ownerEmail) {
    return {
      ok: false,
      message: "Alamat Email Owner belum diisi pada Pengaturan Dashboard Utama.",
      dateWib: targetDate,
      outletsCount: 0,
    };
  }

  const checkedOutletIds =
    settings.daily_report_outlet_ids.length > 0
      ? settings.daily_report_outlet_ids
      : outlets.map((o) => o.id);

  if (checkedOutletIds.length === 0) {
    return {
      ok: false,
      message: "Belum ada outlet yang dicentang untuk laporan harian.",
      dateWib: targetDate,
      outletsCount: 0,
    };
  }

  const bundle = await buildDailyHoldingZipAndSummary({
    dateWib: targetDate,
    outletIds: checkedOutletIds,
    sections: settings.daily_report_sections,
  });

  const delivery = await sendTransactionalEmail({
    to: ownerEmail,
    subject: `[f&b1621] Backup Laporan Keuangan & Akuntansi Harian (${targetDate}) — ${bundle.preview.outlets.length} Outlet`,
    html: bundle.summaryHtml,
    attachments: [
      {
        filename: bundle.zipFilename,
        contentBase64: bundle.zipBuffer.toString("base64"),
        contentType: "application/zip",
      },
    ],
  });

  const admin = createSupabaseAdminClient();
  if (delivery.delivered && !params?.forceSend) {
    await admin
      .from("holding_settings")
      .update({
        last_daily_report_date: targetDate,
        last_daily_report_sent_at: new Date().toISOString(),
      })
      .eq("id", "default");
  }

  await admin.from("audit_logs").insert({
    outlet_id: checkedOutletIds[0] ?? null,
    user_id: null,
    role: "system",
    device: "daily-holding-zip-job",
    ip: "127.0.0.1",
    action: "email.daily_report_zip_sent",
    entity: "holding_settings",
    entity_id: "default",
    before: null,
    after: {
      date_wib: targetDate,
      recipient_email: ownerEmail,
      outlets_count: bundle.preview.outlets.length,
      zip_filename: bundle.zipFilename,
      zip_bytes: bundle.zipBuffer.length,
      net_sales_total: bundle.preview.totals.netSales,
      net_profit_total: bundle.preview.totals.netProfit,
      delivered: delivery.delivered,
      provider: delivery.provider,
      message_id: delivery.messageId,
      error: delivery.error ?? null,
    },
    reason: `Pengiriman email laporan keuangan & akuntansi harian (.zip) tanggal ${targetDate} ke ${ownerEmail}`,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/dashboard/pengaturan-utama");
  revalidatePath("/dashboard/audit");

  return {
    ok: delivery.delivered,
    dateWib: targetDate,
    outletsCount: bundle.preview.outlets.length,
    message: delivery.delivered
      ? `Laporan harian ${targetDate} (${bundle.preview.outlets.length} outlet, lampiran ${bundle.zipFilename} ${Math.max(1, Math.round(bundle.zipBuffer.length / 1024))} KB) berhasil dikirim ke ${ownerEmail}.`
      : `Gagal mengirim email laporan harian: ${delivery.error ?? "Unknown error"}`,
  };
}

export async function triggerManualDailyZipReportAction(
  dateWib?: string
): Promise<ActionResult> {
  await requireStaffRole(["owner"], "pengaturan");
  const res = await dispatchDailyHoldingZipReport({
    dateWib,
    forceSend: true,
  });
  return {
    ok: res.ok,
    message: res.message,
  };
}
