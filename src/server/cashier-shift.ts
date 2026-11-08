"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { formatRupiah } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  UserRole,
} from "@/lib/types/database";
import { requireStaffRole, type ActionResult } from "@/server/auth";

// ============================================================================
// TYPES UNTUK LAPORAN & STRUK TUTUPAN SHIFT KASIR
// ============================================================================

export interface ShiftExpenseItem {
  id: string;
  itemName: string;
  qtyLabel: string;
  amount: number;
}

export interface ShiftOrderSummaryItem {
  id: string;
  orderNo: string;
  createdAt: string;
  paidAt: string | null;
  tableName: string;
  source: OrderSource;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  serviceAmount: number;
  taxAmount: number;
  total: number;
  itemsSummary: string;
}

export interface ShiftSoldProductSummary {
  productName: string;
  totalQty: number;
  totalAmount: number;
}

export interface ShiftCancelledOrderItem {
  id: string;
  orderNo: string;
  createdAt: string;
  cancelledAt: string | null;
  tableName: string;
  source: OrderSource;
  status: "cancelled" | "expired";
  total: number;
  cancelReason: string;
  refundAmount: number;
}

export interface ShiftTransactionMetrics {
  shiftStartIso: string;
  shiftEndIso: string;
  grossSales: number;
  totalDiscount: number;
  totalService: number;
  totalTax: number;
  netSales: number;
  cashRevenue: number;
  qrisRevenue: number;
  cashOrderCount: number;
  qrisOrderCount: number;
  cashRefundTotal: number;
  selfOrderCount: number;
  selfOrderTotal: number;
  selfOrderQrisTotal: number;
  selfOrderCashTotal: number;
  manualOrderCount: number;
  manualOrderTotal: number;
  manualOrderQrisTotal: number;
  manualOrderCashTotal: number;
  paidOrders: ShiftOrderSummaryItem[];
  soldItemsSummary: ShiftSoldProductSummary[];
  cancelledOrders: ShiftCancelledOrderItem[];
}

export interface SavedShiftClosingReport {
  reportId: string;
  reportNo: string;
  outletId: string;
  outletName: string;
  outletAddress: string | null;
  shiftInCashierName: string;
  shiftOutCashierName: string;
  shiftStartIso: string;
  shiftEndIso: string;
  closedAtIso: string;
  closedByUserId: string;
  openingCash: number;
  cashRevenue: number;
  qrisRevenue: number;
  cashRefundTotal: number;
  totalExpenses: number;
  expectedClosingCash: number;
  actualClosingCash: number;
  cashDifference: number;
  closingNotes: string;
  expenses: ShiftExpenseItem[];
  metrics: ShiftTransactionMetrics;
}

export interface ShiftClosingWorkspaceData {
  staff: {
    userId: string;
    fullName: string;
    role: UserRole;
    outletId: string;
  };
  outlet: {
    id: string;
    name: string;
    address: string | null;
  };
  staffNames: string[];
  currentMetrics: ShiftTransactionMetrics;
  recentReports: SavedShiftClosingReport[];
}

// ============================================================================
// ZOD SCHEMAS (Validasi Server sesuai AGENTS.md)
// ============================================================================

const shiftExpenseItemSchema = z.object({
  id: z.string().trim().min(1).max(80),
  itemName: z
    .string()
    .trim()
    .min(1, "Nama barang pengeluaran wajib diisi (contoh: Es Batu, Sayur).")
    .max(120),
  qtyLabel: z
    .string()
    .trim()
    .min(1, "Jumlah/satuan wajib diisi (contoh: 3 bar, 2 ikat).")
    .max(60),
  amount: z
    .number()
    .int("Nominal pengeluaran harus bilangan bulat Rupiah.")
    .min(1, "Nominal pengeluaran harus lebih dari Rp 0.")
    .max(100_000_000),
});

const saveShiftClosingSchema = z.object({
  shiftInCashierName: z
    .string()
    .trim()
    .min(2, "Nama Kasir Shift In wajib diisi.")
    .max(100),
  shiftOutCashierName: z
    .string()
    .trim()
    .min(2, "Nama Kasir Shift Out wajib diisi.")
    .max(100),
  shiftStartIso: z.string().datetime({ offset: true }),
  shiftEndIso: z.string().datetime({ offset: true }),
  openingCash: z
    .number()
    .int("Kas awal harus bilangan bulat Rupiah.")
    .min(0, "Kas awal tidak boleh negatif.")
    .max(500_000_000),
  actualClosingCash: z
    .number()
    .int("Kas akhir aktual harus bilangan bulat Rupiah.")
    .min(0, "Kas akhir aktual tidak boleh negatif.")
    .max(500_000_000),
  closingNotes: z.string().trim().max(500).default(""),
  expenses: z.array(shiftExpenseItemSchema).max(100).default([]),
});

// ============================================================================
// HELPER WAKTU WIB & KOMPUTASI TRANSAKSI SHIFT
// ============================================================================

function getTodayStartIsoWIB(now: Date = new Date()): string {
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const wibDate = new Date(now.getTime() + wibOffsetMs);
  const y = wibDate.getUTCFullYear();
  const m = wibDate.getUTCMonth();
  const d = wibDate.getUTCDate();
  const startOfDayUtcMs = Date.UTC(y, m, d, 0, 0, 0, 0) - wibOffsetMs;
  return new Date(startOfDayUtcMs).toISOString();
}

export async function computeShiftTransactionMetrics(params: {
  outletId: string;
  shiftStartIso: string;
  shiftEndIso: string;
}): Promise<ShiftTransactionMetrics> {
  const admin = createSupabaseAdminClient();

  const [ordersRes, tablesRes] = await Promise.all([
    admin
      .from("orders")
      .select("*")
      .eq("outlet_id", params.outletId)
      .gte("created_at", params.shiftStartIso)
      .lte("created_at", params.shiftEndIso)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("tables")
      .select("id, table_no, name")
      .eq("outlet_id", params.outletId),
  ]);

  const tableMap = new Map<string, string>();
  for (const t of tablesRes.data ?? []) {
    tableMap.set(String(t.id), String(t.name));
  }

  const rawOrders = (ordersRes.data ?? []) as Array<Record<string, unknown>>;
  const orderIds = rawOrders.map((o) => String(o.id));

  const [itemsRes, paymentsRes, refundsRes] =
    orderIds.length > 0
      ? await Promise.all([
          admin
            .from("order_items")
            .select("*")
            .in("order_id", orderIds)
            .order("created_at", { ascending: true }),
          admin.from("payments").select("*").in("order_id", orderIds),
          admin.from("refunds").select("*").in("order_id", orderIds),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

  const itemsByOrder = new Map<
    string,
    Array<{ productName: string; qty: number; lineTotal: number }>
  >();
  for (const row of (itemsRes.data ?? []) as Array<Record<string, unknown>>) {
    const oid = String(row.order_id);
    const list = itemsByOrder.get(oid) ?? [];
    list.push({
      productName: String(row.product_name ?? "Menu"),
      qty: Number(row.qty ?? 1),
      lineTotal: Number(row.line_total ?? 0),
    });
    itemsByOrder.set(oid, list);
  }

  const paymentMethodByOrder = new Map<string, PaymentMethod>();
  for (const row of (paymentsRes.data ?? []) as Array<Record<string, unknown>>) {
    const oid = String(row.order_id);
    paymentMethodByOrder.set(oid, (row.method as PaymentMethod) ?? "cash");
  }

  const refundByOrder = new Map<
    string,
    { amount: number; reason: string }
  >();
  for (const row of (refundsRes.data ?? []) as Array<Record<string, unknown>>) {
    const oid = String(row.order_id);
    refundByOrder.set(oid, {
      amount: Number(row.amount ?? 0),
      reason: String(row.reason ?? ""),
    });
  }

  let grossSales = 0;
  let totalDiscount = 0;
  let totalService = 0;
  let totalTax = 0;
  let netSales = 0;

  let cashRevenue = 0;
  let qrisRevenue = 0;
  let cashOrderCount = 0;
  let qrisOrderCount = 0;
  let cashRefundTotal = 0;

  let selfOrderCount = 0;
  let selfOrderTotal = 0;
  let selfOrderQrisTotal = 0;
  let selfOrderCashTotal = 0;

  let manualOrderCount = 0;
  let manualOrderTotal = 0;
  let manualOrderQrisTotal = 0;
  let manualOrderCashTotal = 0;

  const paidOrders: ShiftOrderSummaryItem[] = [];
  const cancelledOrders: ShiftCancelledOrderItem[] = [];
  const soldProductMap = new Map<
    string,
    { productName: string; totalQty: number; totalAmount: number }
  >();

  for (const raw of rawOrders) {
    const id = String(raw.id);
    const orderNo = String(raw.order_no ?? "");
    const status = (raw.status as OrderStatus) ?? "pending";
    const source = (raw.source as OrderSource) ?? "customer_qr";
    const tableId = (raw.table_id as string | null) ?? null;
    const tableName =
      (tableId ? tableMap.get(tableId) : undefined) ??
      (raw.order_type === "takeaway" ? "Takeaway / Bungkus" : "Tanpa Meja");

    const subtotal = Number(raw.subtotal ?? 0);
    const discount = Number(raw.discount ?? 0);
    const serviceAmount = Number(raw.service_amount ?? 0);
    const taxAmount = Number(raw.tax_amount ?? 0);
    const total = Number(raw.total ?? 0);
    const orderItems = itemsByOrder.get(id) ?? [];

    if (status === "paid" || status === "ready" || status === "served") {
      const method: PaymentMethod =
        paymentMethodByOrder.get(id) ??
        (raw.payment_choice as PaymentMethod | undefined) ??
        "cash";

      grossSales += subtotal;
      totalDiscount += discount;
      totalService += serviceAmount;
      totalTax += taxAmount;
      netSales += total;

      if (method === "cash") {
        cashRevenue += total;
        cashOrderCount += 1;
      } else {
        qrisRevenue += total;
        qrisOrderCount += 1;
      }

      if (source === "customer_qr") {
        selfOrderCount += 1;
        selfOrderTotal += total;
        if (method === "qris") {
          selfOrderQrisTotal += total;
        } else {
          selfOrderCashTotal += total;
        }
      } else {
        manualOrderCount += 1;
        manualOrderTotal += total;
        if (method === "qris") {
          manualOrderQrisTotal += total;
        } else {
          manualOrderCashTotal += total;
        }
      }

      for (const item of orderItems) {
        const existing = soldProductMap.get(item.productName) ?? {
          productName: item.productName,
          totalQty: 0,
          totalAmount: 0,
        };
        existing.totalQty += item.qty;
        existing.totalAmount += item.lineTotal;
        soldProductMap.set(item.productName, existing);
      }

      paidOrders.push({
        id,
        orderNo,
        createdAt: String(raw.created_at),
        paidAt: (raw.paid_at as string | null) ?? null,
        tableName,
        source,
        paymentMethod: method,
        subtotal,
        discount,
        serviceAmount,
        taxAmount,
        total,
        itemsSummary: orderItems
          .map((i) => `${i.qty}x ${i.productName}`)
          .join(", "),
      });
    } else if (status === "cancelled" || status === "expired") {
      const refundInfo = refundByOrder.get(id);
      const refundAmt = refundInfo?.amount ?? 0;
      cashRefundTotal += refundAmt;

      const cancelReason =
        (raw.cancel_reason as string | null) ??
        refundInfo?.reason ??
        (status === "expired"
          ? "Kedaluwarsa otomatis (> 15 menit belum dibayar)"
          : "Dibatalkan oleh Kasir");

      cancelledOrders.push({
        id,
        orderNo,
        createdAt: String(raw.created_at),
        cancelledAt: (raw.cancelled_at as string | null) ?? null,
        tableName,
        source,
        status,
        total,
        cancelReason,
        refundAmount: refundAmt,
      });
    }
  }

  const soldItemsSummary = Array.from(soldProductMap.values()).sort(
    (a, b) => b.totalQty - a.totalQty
  );

  return {
    shiftStartIso: params.shiftStartIso,
    shiftEndIso: params.shiftEndIso,
    grossSales,
    totalDiscount,
    totalService,
    totalTax,
    netSales,
    cashRevenue,
    qrisRevenue,
    cashOrderCount,
    qrisOrderCount,
    cashRefundTotal,
    selfOrderCount,
    selfOrderTotal,
    selfOrderQrisTotal,
    selfOrderCashTotal,
    manualOrderCount,
    manualOrderTotal,
    manualOrderQrisTotal,
    manualOrderCashTotal,
    paidOrders,
    soldItemsSummary,
    cancelledOrders,
  };
}

/**
 * Server Action: Mengambil pratinjau metrik transaksi untuk rentang waktu shift tertentu.
 */
export async function getShiftClosingPreviewAction(rawInput: {
  shiftStartIso: string;
  shiftEndIso: string;
}): Promise<ActionResult & { metrics?: ShiftTransactionMetrics }> {
  const staff = await requireStaffRole(["owner", "cashier"]);
  const schema = z.object({
    shiftStartIso: z.string().datetime({ offset: true }),
    shiftEndIso: z.string().datetime({ offset: true }),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Rentang waktu shift tidak valid." };
  }

  const metrics = await computeShiftTransactionMetrics({
    outletId: staff.outletId,
    shiftStartIso: parsed.data.shiftStartIso,
    shiftEndIso: parsed.data.shiftEndIso,
  });

  return {
    ok: true,
    message: "Data transaksi shift berhasil dimuat.",
    metrics,
  };
}

/**
 * Mengambil data awal untuk Tab Tutupan Shift Kasir (/kasir).
 */
export async function getShiftClosingWorkspaceData(): Promise<ShiftClosingWorkspaceData> {
  const staff = await requireStaffRole(["owner", "cashier"]);
  const admin = createSupabaseAdminClient();

  const nowIso = new Date().toISOString();
  const todayStartIso = getTodayStartIsoWIB();

  const [outletRes, usersRes, shiftLogsRes] = await Promise.all([
    admin.from("outlets").select("*").eq("id", staff.outletId).single(),
    admin
      .from("users")
      .select("full_name, role, is_active")
      .eq("outlet_id", staff.outletId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("full_name", { ascending: true }),
    admin
      .from("audit_logs")
      .select("id, after, created_at")
      .eq("entity", "cashier_shifts")
      .eq("action", "shift.closed")
      .order("id", { ascending: false })
      .limit(15),
  ]);

  const rawOutlet = (outletRes.data ?? {}) as Record<string, unknown>;
  const staffNames = Array.from(
    new Set([
      staff.fullName,
      ...((usersRes.data ?? []) as Array<Record<string, unknown>>).map((u) =>
        String(u.full_name ?? "").trim()
      ),
    ])
  ).filter(Boolean);

  const recentReports: SavedShiftClosingReport[] = [];
  for (const row of (shiftLogsRes.data ?? []) as Array<Record<string, unknown>>) {
    const afterObj = row.after as SavedShiftClosingReport | null;
    if (
      afterObj &&
      typeof afterObj === "object" &&
      afterObj.outletId === staff.outletId
    ) {
      recentReports.push(afterObj);
    }
  }

  const currentMetrics = await computeShiftTransactionMetrics({
    outletId: staff.outletId,
    shiftStartIso: todayStartIso,
    shiftEndIso: nowIso,
  });

  return {
    staff: {
      userId: staff.userId,
      fullName: staff.fullName,
      role: staff.role,
      outletId: staff.outletId,
    },
    outlet: {
      id: String(rawOutlet.id ?? staff.outletId),
      name: String(rawOutlet.name ?? "1621 GROUP"),
      address: (rawOutlet.address as string | null) ?? null,
    },
    staffNames,
    currentMetrics,
    recentReports,
  };
}

/**
 * Server Action: Menyimpan Laporan Tutupan Shift Kasir ke audit_logs & mengembalikan data struk siap cetak.
 */
export async function saveShiftClosingReportAction(rawInput: {
  shiftInCashierName: string;
  shiftOutCashierName: string;
  shiftStartIso: string;
  shiftEndIso: string;
  openingCash: number;
  actualClosingCash: number;
  closingNotes: string;
  expenses: ShiftExpenseItem[];
}): Promise<ActionResult & { report?: SavedShiftClosingReport }> {
  const parsed = saveShiftClosingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Data tutupan shift tidak valid.",
    };
  }

  const staff = await requireStaffRole(["owner", "cashier"]);
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "cashier-browser";

  const admin = createSupabaseAdminClient();
  const { data: outletRow } = await admin
    .from("outlets")
    .select("id, name, address")
    .eq("id", staff.outletId)
    .single();

  const metrics = await computeShiftTransactionMetrics({
    outletId: staff.outletId,
    shiftStartIso: parsed.data.shiftStartIso,
    shiftEndIso: parsed.data.shiftEndIso,
  });

  const totalExpenses = parsed.data.expenses.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const expectedClosingCash =
    parsed.data.openingCash +
    metrics.cashRevenue -
    metrics.cashRefundTotal -
    totalExpenses;
  const cashDifference = parsed.data.actualClosingCash - expectedClosingCash;

  const closedAtIso = new Date().toISOString();
  const reportId = crypto.randomUUID();
  const datePart = closedAtIso.slice(0, 10).replace(/-/g, "");
  const randPart = String(Math.floor(1000 + Math.random() * 9000));
  const reportNo = `SHIFT-${datePart}-${randPart}`;

  const report: SavedShiftClosingReport = {
    reportId,
    reportNo,
    outletId: staff.outletId,
    outletName: String(outletRow?.name ?? "1621 GROUP"),
    outletAddress: (outletRow?.address as string | null) ?? null,
    shiftInCashierName: parsed.data.shiftInCashierName,
    shiftOutCashierName: parsed.data.shiftOutCashierName,
    shiftStartIso: parsed.data.shiftStartIso,
    shiftEndIso: parsed.data.shiftEndIso,
    closedAtIso,
    closedByUserId: staff.userId,
    openingCash: parsed.data.openingCash,
    cashRevenue: metrics.cashRevenue,
    qrisRevenue: metrics.qrisRevenue,
    cashRefundTotal: metrics.cashRefundTotal,
    totalExpenses,
    expectedClosingCash,
    actualClosingCash: parsed.data.actualClosingCash,
    cashDifference,
    closingNotes: parsed.data.closingNotes,
    expenses: parsed.data.expenses,
    metrics,
  };

  const reason = `Tutupan Shift ${reportNo} (${parsed.data.shiftInCashierName} -> ${parsed.data.shiftOutCashierName}) • Kas Akhir Aktual ${formatRupiah(parsed.data.actualClosingCash)}`;

  await admin.rpc("set_audit_context", {
    p_user_id: staff.userId,
    p_role: staff.role,
    p_device: device,
    p_ip: ip,
    p_reason: reason,
  });

  const { error: auditErr } = await admin.from("audit_logs").insert({
    actor_user_id: staff.userId,
    actor_role: staff.role,
    device,
    ip,
    action: "shift.closed",
    entity: "cashier_shifts",
    entity_id: reportId,
    before: null,
    after: report as unknown as Record<string, unknown>,
    reason,
  });

  if (auditErr) {
    return {
      ok: false,
      message: `Gagal menyimpan laporan tutupan shift: ${auditErr.message}`,
    };
  }

  revalidatePath("/kasir");
  revalidatePath("/dashboard/audit");

  return {
    ok: true,
    message: `Laporan Tutupan Shift #${reportNo} berhasil disimpan dan siap dicetak!`,
    report,
  };
}

