"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import {
  calculateCashChange,
  calculateDiscountAmount,
  calculateOrderTotals,
  formatRupiah,
  type TaxAndServiceConfig,
} from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  CategoryRow,
  OrderItemRow,
  OrderSource,
  OrderStatus,
  OrderType,
  PaymentMethod,
  ProductRow,
  RefundReasonCategory,
  TableRow,
  UserRole,
} from "@/lib/types/database";
import { requireStaffRole, type ActionResult } from "@/server/auth";
import type { CashierOrderItemView } from "@/server/cashier";
import { recordOrderPaidInventoryAndAccounting } from "@/server/inventory";

// ============================================================================
// ZOD SCHEMAS (Validasi Server sesuai AGENTS.md)
// ============================================================================

const createManualOrderSchema = z
  .object({
    orderType: z.enum(["dine_in", "takeaway"]),
    tableId: z.string().uuid("ID meja tidak valid.").nullable().optional(),
    items: z
      .array(
        z.object({
          productId: z.string().uuid("ID produk tidak valid."),
          qty: z.number().int().min(1).max(100),
          note: z.string().trim().max(160).nullable().optional(),
        })
      )
      .min(1, "Pilih minimal 1 item menu.")
      .max(40, "Maksimal 40 jenis item per order."),
    discountType: z.enum(["none", "amount", "percent"]).default("none"),
    discountValue: z.number().min(0).default(0),
    discountReason: z.string().trim().max(200).optional().default(""),
    paymentMethod: z.enum(["cash", "qris"]),
    amountReceived: z
      .number()
      .int("Nominal uang diterima harus bilangan bulat Rupiah.")
      .min(0),
    idempotencyKey: z.string().trim().min(8).max(100),
  })
  .refine(
    (val) =>
      val.orderType === "takeaway" ||
      (typeof val.tableId === "string" && val.tableId.length > 0),
    {
      message: "Order Makan di Tempat (Dine-in) wajib memilih Nomor Meja.",
      path: ["tableId"],
    }
  );

// ============================================================================
// TYPES UNTUK ORDER MANUAL & RIWAYAT TRANSAKSI
// ============================================================================

export interface ManualOrderWorkspaceData {
  staff: {
    userId: string;
    fullName: string;
    role: UserRole;
    outletId: string;
  };
  outlet: {
    id: string;
    name: string;
    taxConfig: TaxAndServiceConfig;
    maxCashierDiscountPercent: number | null;
    maxCashierDiscountAmount: number | null;
    qrisEnabled: boolean;
    qrisMerchantName: string;
    qrisRawPayload: string | null;
  };
  categories: CategoryRow[];
  products: ProductRow[];
  tables: Array<Pick<TableRow, "id" | "table_no" | "name" | "is_active">>;
}

export interface TransactionRowView {
  id: string;
  orderNo: string;
  source: OrderSource;
  orderType: OrderType;
  tableName: string;
  status: OrderStatus;
  version: number;
  subtotal: number;
  discount: number;
  discountReason: string | null;
  serviceRate: number | null;
  serviceAmount: number;
  taxRate: number | null;
  taxAmount: number;
  priceIncludesTax: boolean;
  total: number;
  cashierId: string | null;
  cashierName: string;
  paymentMethod: PaymentMethod | null;
  amountReceived: number | null;
  changeAmount: number | null;
  createdAt: string;
  paidAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: CashierOrderItemView[];
  refund: {
    id: string;
    amount: number;
    reasonCategory: RefundReasonCategory;
    reason: string;
    createdAt: string;
  } | null;
}

export interface FinancialSummaryMetrics {
  periodLabel: string;
  totalOrdersCount: number;
  paidOrdersCount: number;
  cancelledOrdersCount: number;
  grossSales: number;
  totalDiscount: number;
  totalRefund: number;
  netSales: number;
  cashGrossSales: number;
  qrisGrossSales: number;
}

export interface TransactionsDashboardData {
  staff: {
    userId: string;
    fullName: string;
    role: UserRole;
    outletId: string;
  };
  cashiers: Array<{ id: string; fullName: string; role: UserRole }>;
  summary: FinancialSummaryMetrics;
  transactions: TransactionRowView[];
}

function getWibDayBoundsIso(daysLookback: number): {
  startIso: string;
  endIso: string;
  label: string;
} {
  // WIB = UTC+7
  const nowUtcMs = Date.now();
  const wibOffsetMs = 7 * 60 * 60 * 1000;
  const nowWib = new Date(nowUtcMs + wibOffsetMs);

  const year = nowWib.getUTCFullYear();
  const month = nowWib.getUTCMonth();
  const date = nowWib.getUTCDate();

  const startOfTodayWibUtcMs =
    Date.UTC(year, month, date, 0, 0, 0, 0) - wibOffsetMs;
  const endOfTodayWibUtcMs =
    Date.UTC(year, month, date, 23, 59, 59, 999) - wibOffsetMs;

  const startMs =
    daysLookback <= 0
      ? startOfTodayWibUtcMs
      : startOfTodayWibUtcMs - daysLookback * 24 * 60 * 60 * 1000;

  const label =
    daysLookback === 0
      ? "Hari Ini (WIB)"
      : daysLookback === 6
        ? "7 Hari Terakhir"
        : daysLookback === 29
          ? "30 Hari Terakhir"
          : "Semua Periode";

  return {
    startIso: new Date(startMs).toISOString(),
    endIso: new Date(endOfTodayWibUtcMs).toISOString(),
    label,
  };
}

/**
 * Mengambil seluruh data untuk halaman Buat Order Manual (/order-manual).
 */
export async function getManualOrderWorkspaceData(): Promise<ManualOrderWorkspaceData> {
  const staff = await requireStaffRole(["owner", "cashier"]);
  const admin = createSupabaseAdminClient();

  const [outletRes, catRes, prodRes, tablesRes] = await Promise.all([
    admin.from("outlets").select("*").eq("id", staff.outletId).single(),
    admin
      .from("categories")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true }),
    admin
      .from("products")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
    admin
      .from("tables")
      .select("id, table_no, name, is_active")
      .eq("outlet_id", staff.outletId)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("table_no", { ascending: true }),
  ]);

  const rawOutlet = (outletRes.data ?? {}) as Record<string, unknown>;

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
      taxConfig: {
        taxEnabled: Boolean(rawOutlet.tax_enabled),
        taxPercent:
          rawOutlet.tax_percent !== null && rawOutlet.tax_percent !== undefined
            ? Number(rawOutlet.tax_percent)
            : null,
        serviceEnabled: Boolean(rawOutlet.service_enabled),
        servicePercent:
          rawOutlet.service_percent !== null &&
          rawOutlet.service_percent !== undefined
            ? Number(rawOutlet.service_percent)
            : null,
        priceIncludesTax: Boolean(rawOutlet.price_includes_tax),
      },
      maxCashierDiscountPercent:
        rawOutlet.max_cashier_discount_percent !== null &&
        rawOutlet.max_cashier_discount_percent !== undefined
          ? Number(rawOutlet.max_cashier_discount_percent)
          : null,
      maxCashierDiscountAmount:
        rawOutlet.max_cashier_discount_amount !== null &&
        rawOutlet.max_cashier_discount_amount !== undefined
          ? Number(rawOutlet.max_cashier_discount_amount)
          : null,
      qrisEnabled: Boolean(rawOutlet.qris_enabled ?? false),
      qrisMerchantName: String(
        (rawOutlet.qris_merchant_name as string | null) ??
          rawOutlet.name ??
          "1621 GROUP"
      ),
      qrisRawPayload: (rawOutlet.qris_raw_payload as string | null) ?? null,
    },
    categories: (catRes.data ?? []) as CategoryRow[],
    products: (prodRes.data ?? []) as ProductRow[],
    tables: (tablesRes.data ?? []) as Array<
      Pick<TableRow, "id" | "table_no" | "name" | "is_active">
    >,
  };
}

/**
 * Server Action: Membuat Order Manual oleh Kasir (Dine-in atau Takeaway)
 * sekaligus menerima pembayarannya (Tunai / QRIS) sehingga langsung berstatus PAID
 * dan masuk ke Layar Dapur (/dapur).
 */
export async function createManualCashierOrderAction(rawInput: {
  orderType: OrderType;
  tableId?: string | null;
  items: Array<{ productId: string; qty: number; note?: string | null }>;
  discountType?: "none" | "amount" | "percent";
  discountValue?: number;
  discountReason?: string;
  paymentMethod: PaymentMethod;
  amountReceived: number;
  idempotencyKey: string;
}): Promise<ActionResult & { orderId?: string; orderNo?: string; changeAmount?: number }> {
  const parsed = createManualOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Data order manual tidak valid.",
    };
  }

  const {
    orderType,
    tableId,
    items,
    discountType,
    discountValue,
    discountReason,
    paymentMethod,
    amountReceived,
    idempotencyKey,
  } = parsed.data;

  const staff = await requireStaffRole(["owner", "cashier"]);
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "cashier-manual-pos";

  const admin = createSupabaseAdminClient();
  await admin.rpc("set_audit_context", {
    p_user_id: staff.userId,
    p_role: staff.role,
    p_device: device,
    p_ip: ip,
    p_reason: "Pembuatan order manual langsung di kasir",
  });

  // 1. Cek idempotency key agar klik ganda tidak membuat 2 order
  const { data: existingOrder } = await admin
    .from("orders")
    .select("id, order_no")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  if (existingOrder) {
    return {
      ok: true,
      orderId: String(existingOrder.id),
      orderNo: String(existingOrder.order_no),
      changeAmount: 0,
      message: `Order #${existingOrder.order_no} sudah berhasil dibuat.`,
    };
  }

  // 2. Validasi meja jika dine_in
  let resolvedTableId: string | null = null;
  if (orderType === "dine_in") {
    const { data: tbl } = await admin
      .from("tables")
      .select("id, is_active, deleted_at")
      .eq("id", tableId ?? "")
      .eq("outlet_id", staff.outletId)
      .maybeSingle();

    if (!tbl || !tbl.is_active || tbl.deleted_at !== null) {
      return {
        ok: false,
        message: "Meja yang dipilih tidak ditemukan atau sedang nonaktif.",
      };
    }
    resolvedTableId = String(tbl.id);
  }

  // 3. Ambil produk dari DB untuk harga snapshot yang sah
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const [{ data: dbProducts }, { data: outletRow }] = await Promise.all([
    admin
      .from("products")
      .select("id, name, price, is_available, is_active, deleted_at")
      .eq("outlet_id", staff.outletId)
      .in("id", productIds),
    admin.from("outlets").select("*").eq("id", staff.outletId).single(),
  ]);

  const prodMap = new Map<
    string,
    { name: string; price: number; isAvailable: boolean }
  >();
  for (const p of dbProducts ?? []) {
    if (p.is_active && p.deleted_at === null) {
      prodMap.set(String(p.id), {
        name: String(p.name),
        price: Number(p.price),
        isAvailable: Boolean(p.is_available),
      });
    }
  }

  const verifiedItems: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    qty: number;
    note: string | null;
    lineTotal: number;
  }> = [];

  for (const item of items) {
    const prod = prodMap.get(item.productId);
    if (!prod) {
      return {
        ok: false,
        message: "Salah satu produk tidak ditemukan atau sudah tidak aktif.",
      };
    }
    if (!prod.isAvailable) {
      return {
        ok: false,
        message: `Menu "${prod.name}" sedang habis dan tidak bisa dipesan.`,
      };
    }
    verifiedItems.push({
      productId: item.productId,
      productName: prod.name,
      unitPrice: prod.price,
      qty: item.qty,
      note: item.note && item.note.length > 0 ? item.note : null,
      lineTotal: prod.price * item.qty,
    });
  }

  const subtotal = verifiedItems.reduce((acc, i) => acc + i.lineTotal, 0);

  // 4. Validasi & hitung diskon
  let computedDiscount = 0;
  try {
    computedDiscount = calculateDiscountAmount(
      subtotal,
      discountType === "none"
        ? { type: "none" }
        : { type: discountType, value: discountValue }
    );
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Diskon tidak valid.",
    };
  }

  if (computedDiscount > 0 && discountReason.trim().length < 3) {
    return {
      ok: false,
      message: "Alasan pemberian diskon wajib diisi (minimal 3 karakter).",
    };
  }

  const rawOutlet = (outletRow ?? {}) as Record<string, unknown>;
  if (staff.role === "cashier" && computedDiscount > 0) {
    const maxPct =
      rawOutlet.max_cashier_discount_percent !== null &&
      rawOutlet.max_cashier_discount_percent !== undefined
        ? Number(rawOutlet.max_cashier_discount_percent)
        : null;
    const maxAmt =
      rawOutlet.max_cashier_discount_amount !== null &&
      rawOutlet.max_cashier_discount_amount !== undefined
        ? Number(rawOutlet.max_cashier_discount_amount)
        : null;

    if (maxAmt !== null && computedDiscount > maxAmt) {
      return {
        ok: false,
        message: `Nominal diskon (${formatRupiah(computedDiscount)}) melebihi batas maksimum Kasir (${formatRupiah(maxAmt)}).`,
      };
    }
    if (maxPct !== null && subtotal > 0) {
      const pct = (computedDiscount / subtotal) * 100;
      if (pct > maxPct + 0.001) {
        return {
          ok: false,
          message: `Persentase diskon (${pct.toFixed(1)}%) melebihi batas maksimum Kasir (${maxPct}%).`,
        };
      }
    }
  }

  // 5. Hitung total & pajak menggunakan satu-satunya helper src/lib/money.ts
  const taxConfig: TaxAndServiceConfig = {
    taxEnabled: Boolean(rawOutlet.tax_enabled),
    taxPercent:
      rawOutlet.tax_percent !== null && rawOutlet.tax_percent !== undefined
        ? Number(rawOutlet.tax_percent)
        : null,
    serviceEnabled: Boolean(rawOutlet.service_enabled),
    servicePercent:
      rawOutlet.service_percent !== null &&
      rawOutlet.service_percent !== undefined
        ? Number(rawOutlet.service_percent)
        : null,
    priceIncludesTax: Boolean(rawOutlet.price_includes_tax),
  };

  const totals = calculateOrderTotals({
    items: verifiedItems.map((i) => ({
      unitPrice: i.unitPrice,
      qty: i.qty,
    })),
    discount:
      computedDiscount > 0
        ? { type: "amount", value: computedDiscount }
        : { type: "none" },
    config: taxConfig,
  });

  const effectiveReceived =
    paymentMethod === "qris" ? totals.total : amountReceived;
  let changeAmount = 0;
  try {
    changeAmount = calculateCashChange(totals.total, effectiveReceived);
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Nominal uang diterima kurang dari total tagihan.",
    };
  }

  // 6. Buat baris order (status awal 'pending' agar trigger order_items mengizinkan insert item,
  //    lalu langsung dikunci menjadi 'paid' dalam alur yang sama)
  const orderNo = `KSR-${Date.now().toString(36).toUpperCase().slice(-5)}-${Math.floor(10 + Math.random() * 89)}`;

  const { data: createdOrder, error: createErr } = await admin
    .from("orders")
    .insert({
      outlet_id: staff.outletId,
      order_no: orderNo,
      source: "cashier",
      order_type: orderType,
      table_id: resolvedTableId,
      status: "pending",
      subtotal: totals.subtotal,
      discount: totals.discount,
      discount_reason: totals.discount > 0 ? discountReason.trim() : null,
      service_rate: totals.serviceRate,
      service_amount: totals.serviceAmount,
      tax_rate: totals.taxRate,
      tax_amount: totals.taxAmount,
      price_includes_tax: totals.priceIncludesTax,
      total: totals.total,
      idempotency_key: idempotencyKey,
    })
    .select("id, order_no, version")
    .single();

  if (createErr || !createdOrder) {
    return {
      ok: false,
      message: `Gagal membuat order manual: ${createErr?.message ?? "Unknown error"}`,
    };
  }

  const orderId = String(createdOrder.id);

  // 7. Simpan snapshot order_items
  const { error: itemsErr } = await admin.from("order_items").insert(
    verifiedItems.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      unit_price: item.unitPrice,
      qty: item.qty,
      note: item.note,
      line_total: item.lineTotal,
    }))
  );

  if (itemsErr) {
    return {
      ok: false,
      message: `Gagal menyimpan item order manual: ${itemsErr.message}`,
    };
  }

  // 8. Ubah status menjadi PAID dan catat pembayaran sah
  const paidAtIso = new Date().toISOString();
  const { error: paidErr } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: paidAtIso,
      paid_by: staff.userId,
    })
    .eq("id", orderId)
    .eq("status", "pending");

  if (paidErr) {
    return {
      ok: false,
      message: `Gagal mengonfirmasi status pembayaran order manual: ${paidErr.message}`,
    };
  }

  const { error: payInsErr } = await admin.from("payments").insert({
    order_id: orderId,
    method: paymentMethod,
    amount_received: effectiveReceived,
    change_amount: changeAmount,
    created_by: staff.userId,
  });

  if (payInsErr) {
    if (paymentMethod === "qris" && payInsErr.message.includes("payment_method")) {
      await admin.from("payments").insert({
        order_id: orderId,
        method: "cash",
        amount_received: effectiveReceived,
        change_amount: changeAmount,
        created_by: staff.userId,
      });
    } else {
      return {
        ok: false,
        message: `Gagal mencatat pembayaran: ${payInsErr.message}`,
      };
    }
  }

  if (paymentMethod === "qris") {
    await admin.from("audit_logs").insert({
      outlet_id: staff.outletId,
      user_id: staff.userId,
      role: staff.role,
      device,
      ip,
      action: "payment.qris_verified",
      entity: "orders",
      entity_id: orderId,
      before: { status: "pending" },
      after: {
        status: "paid",
        payment_method: "qris",
        amount_received: effectiveReceived,
        verified_by: staff.fullName,
      },
      reason: `Order manual kasir #${orderNo} dibayar via QRIS (${formatRupiah(totals.total)})`,
      prev_hash: "",
      hash: "",
    });
  }

  try {
    await recordOrderPaidInventoryAndAccounting({
      outletId: staff.outletId,
      orderId,
      orderNo,
      orderTotal: totals.total,
      paymentMethod,
      actorUserId: staff.userId,
    });
  } catch {
    // Jangan gagalkan transaksi POS kasir bila pencatatan jurnal sekunder gagal
  }

  revalidatePath("/order-manual");
  revalidatePath("/kasir");
  revalidatePath("/dapur");
  revalidatePath("/dashboard/transaksi");
  revalidatePath("/dashboard/inventory");
  revalidatePath("/dashboard/keuangan");

  return {
    ok: true,
    orderId,
    orderNo,
    changeAmount,
    message:
      paymentMethod === "qris"
        ? `Order Manual #${orderNo} (${formatRupiah(totals.total)} via QRIS) berhasil dibuat dan langsung masuk ke Layar Dapur!`
        : `Order Manual #${orderNo} (${formatRupiah(totals.total)} Tunai, Kembalian: ${formatRupiah(changeAmount)}) berhasil dibuat dan masuk ke Layar Dapur!`,
  };
}

/**
 * Mengambil data Riwayat Transaksi & Ringkasan Harian (Penjualan Kotor, Refund, Penjualan Bersih)
 * untuk halaman /dashboard/transaksi dan /dashboard.
 */
export async function getTransactionsDashboardData(rawFilters?: {
  period?: "today" | "7d" | "30d" | "all";
  status?: string;
  cashierId?: string;
}): Promise<TransactionsDashboardData> {
  const staff = await requireStaffRole(["owner", "cashier"]);
  const admin = createSupabaseAdminClient();

  const period = rawFilters?.period ?? "today";
  const bounds =
    period === "today"
      ? getWibDayBoundsIso(0)
      : period === "7d"
        ? getWibDayBoundsIso(6)
        : period === "30d"
          ? getWibDayBoundsIso(29)
          : null;

  let ordersQuery = admin
    .from("orders")
    .select("*")
    .eq("outlet_id", staff.outletId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(200);

  if (bounds) {
    ordersQuery = ordersQuery
      .gte("created_at", bounds.startIso)
      .lte("created_at", bounds.endIso);
  }

  const [ordersRes, profilesRes, tablesRes] = await Promise.all([
    ordersQuery,
    admin
      .from("profiles")
      .select("id, full_name, role")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null),
    admin
      .from("tables")
      .select("id, name")
      .eq("outlet_id", staff.outletId),
  ]);

  const profileMap = new Map<string, { fullName: string; role: UserRole }>();
  const cashiers: Array<{ id: string; fullName: string; role: UserRole }> = [];
  for (const p of profilesRes.data ?? []) {
    const role = p.role as UserRole;
    const entry = {
      id: String(p.id),
      fullName: String(p.full_name),
      role,
    };
    profileMap.set(entry.id, { fullName: entry.fullName, role: entry.role });
    if (role === "cashier" || role === "owner") {
      cashiers.push(entry);
    }
  }

  const tableMap = new Map<string, string>();
  for (const t of tablesRes.data ?? []) {
    tableMap.set(String(t.id), String(t.name));
  }

  const rawOrders = (ordersRes.data ?? []) as Array<Record<string, unknown>>;
  const orderIds = rawOrders.map((o) => String(o.id));

  const [itemsRes, paymentsRes, refundsRes, qrisAuditsRes] =
    orderIds.length > 0
      ? await Promise.all([
          admin
            .from("order_items")
            .select("*")
            .in("order_id", orderIds)
            .order("created_at", { ascending: true }),
          admin.from("payments").select("*").in("order_id", orderIds),
          admin.from("refunds").select("*").in("order_id", orderIds),
          admin
            .from("audit_logs")
            .select("entity_id")
            .eq("entity", "orders")
            .in("entity_id", orderIds)
            .eq("action", "payment.qris_verified"),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ];

  const qrisOrderIds = new Set<string>(
    ((qrisAuditsRes.data ?? []) as Array<{ entity_id: string }>).map((a) =>
      String(a.entity_id)
    )
  );

  const itemsByOrder = new Map<string, CashierOrderItemView[]>();
  for (const row of (itemsRes.data ?? []) as OrderItemRow[]) {
    const list = itemsByOrder.get(row.order_id) ?? [];
    list.push({
      id: row.id,
      productId: row.product_id,
      productName: row.product_name,
      unitPrice: Number(row.unit_price),
      qty: Number(row.qty),
      note: row.note ?? null,
      lineTotal: Number(row.line_total),
    });
    itemsByOrder.set(row.order_id, list);
  }

  const paymentByOrder = new Map<
    string,
    {
      method: PaymentMethod;
      amountReceived: number;
      changeAmount: number;
    }
  >();
  for (const p of (paymentsRes.data ?? []) as Array<Record<string, unknown>>) {
    const ordId = String(p.order_id);
    const rawMethod = (p.method as PaymentMethod) ?? "cash";
    paymentByOrder.set(ordId, {
      method: qrisOrderIds.has(ordId) ? "qris" : rawMethod,
      amountReceived: Number(p.amount_received),
      changeAmount: Number(p.change_amount),
    });
  }

  const refundByOrder = new Map<
    string,
    TransactionRowView["refund"]
  >();
  for (const r of (refundsRes.data ?? []) as Array<Record<string, unknown>>) {
    const ordId = String(r.order_id);
    refundByOrder.set(ordId, {
      id: String(r.id),
      amount: Number(r.amount),
      reasonCategory: (r.reason_category as RefundReasonCategory) ?? "other",
      reason: String(r.reason ?? ""),
      createdAt: String(r.created_at),
    });
  }

  const allTransactions: TransactionRowView[] = rawOrders.map((raw) => {
    const id = String(raw.id);
    const tableId = (raw.table_id as string | null) ?? null;
    const paidBy = (raw.paid_by as string | null) ?? null;
    const pay = paymentByOrder.get(id) ?? null;
    const ref = refundByOrder.get(id) ?? null;

    return {
      id,
      orderNo: String(raw.order_no),
      source: (raw.source as OrderSource) ?? "customer_qr",
      orderType: (raw.order_type as OrderType) ?? "dine_in",
      tableName:
        (tableId ? tableMap.get(tableId) : undefined) ??
        (raw.order_type === "takeaway" ? "Takeaway / Bungkus" : "-"),
      status: raw.status as OrderStatus,
      version: Number(raw.version ?? 1),
      subtotal: Number(raw.subtotal ?? 0),
      discount: Number(raw.discount ?? 0),
      discountReason: (raw.discount_reason as string | null) ?? null,
      serviceRate:
        raw.service_rate !== null && raw.service_rate !== undefined
          ? Number(raw.service_rate)
          : null,
      serviceAmount: Number(raw.service_amount ?? 0),
      taxRate:
        raw.tax_rate !== null && raw.tax_rate !== undefined
          ? Number(raw.tax_rate)
          : null,
      taxAmount: Number(raw.tax_amount ?? 0),
      priceIncludesTax: Boolean(raw.price_includes_tax),
      total: Number(raw.total ?? 0),
      cashierId: paidBy,
      cashierName: paidBy
        ? profileMap.get(paidBy)?.fullName ?? "Staf Kasir"
        : "-",
      paymentMethod: pay?.method ?? null,
      amountReceived: pay?.amountReceived ?? null,
      changeAmount: pay?.changeAmount ?? null,
      createdAt: String(raw.created_at),
      paidAt: (raw.paid_at as string | null) ?? null,
      servedAt: (raw.served_at as string | null) ?? null,
      cancelledAt: (raw.cancelled_at as string | null) ?? null,
      cancelReason: (raw.cancel_reason as string | null) ?? null,
      items: itemsByOrder.get(id) ?? [],
      refund: ref,
    };
  });

  // Hitung Ringkasan Keuangan (Kotor, Refund, Bersih) dari transaksi periode ini
  let paidOrdersCount = 0;
  let cancelledOrdersCount = 0;
  let grossSales = 0;
  let totalDiscount = 0;
  let totalRefund = 0;
  let cashGrossSales = 0;
  let qrisGrossSales = 0;

  for (const tx of allTransactions) {
    if (tx.status === "cancelled") {
      cancelledOrdersCount += 1;
    }
    // Order yang pernah dibayar (memiliki paidAt atau payment) dihitung dalam Penjualan Kotor
    if (tx.paidAt !== null || tx.paymentMethod !== null) {
      paidOrdersCount += 1;
      grossSales += tx.total;
      totalDiscount += tx.discount;
      if (tx.paymentMethod === "qris") {
        qrisGrossSales += tx.total;
      } else {
        cashGrossSales += tx.total;
      }
    }
    if (tx.refund) {
      totalRefund += tx.refund.amount;
    }
  }

  const netSales = grossSales - totalRefund;

  // Terapkan filter status & kasir untuk tabel tampilan
  const filteredTransactions = allTransactions.filter((tx) => {
    if (
      rawFilters?.status &&
      rawFilters.status !== "all" &&
      tx.status !== rawFilters.status
    ) {
      return false;
    }
    if (
      rawFilters?.cashierId &&
      rawFilters.cashierId !== "all" &&
      tx.cashierId !== rawFilters.cashierId
    ) {
      return false;
    }
    return true;
  });

  return {
    staff: {
      userId: staff.userId,
      fullName: staff.fullName,
      role: staff.role,
      outletId: staff.outletId,
    },
    cashiers,
    summary: {
      periodLabel: bounds?.label ?? "Semua Periode",
      totalOrdersCount: allTransactions.length,
      paidOrdersCount,
      cancelledOrdersCount,
      grossSales,
      totalDiscount,
      totalRefund,
      netSales,
      cashGrossSales,
      qrisGrossSales,
    },
    transactions: filteredTransactions,
  };
}

