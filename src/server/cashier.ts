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
  UserRole,
} from "@/lib/types/database";
import { requireStaffRole, type ActionResult } from "@/server/auth";
import { runExpireOverdueOrdersJob } from "@/server/order-expiry";

// ============================================================================
// ZOD SCHEMAS (Validasi Server sesuai AGENTS.md)
// ============================================================================

const reviseOrderItemsSchema = z.object({
  orderId: z.string().uuid("ID order tidak valid."),
  expectedVersion: z.number().int().min(1),
  reason: z
    .string()
    .trim()
    .min(3, "Alasan revisi minimal 3 karakter.")
    .max(200, "Alasan revisi maksimal 200 karakter."),
  items: z
    .array(
      z.object({
        productId: z.string().uuid("ID produk tidak valid."),
        qty: z.number().int().min(1).max(100),
        note: z.string().trim().max(160).nullable().optional(),
      })
    )
    .min(1, "Order harus memiliki minimal 1 item. Gunakan fitur Batalkan Order jika semua item dibatalkan.")
    .max(40),
});

const applyDiscountSchema = z.object({
  orderId: z.string().uuid("ID order tidak valid."),
  expectedVersion: z.number().int().min(1),
  discountType: z.enum(["none", "amount", "percent"]),
  discountValue: z.number().min(0),
  reason: z.string().trim().max(200),
});

const processPaymentSchema = z.object({
  orderId: z.string().uuid("ID order tidak valid."),
  expectedVersion: z.number().int().min(1),
  method: z.enum(["qris", "cash"]),
  amountReceived: z.number().int("Nominal uang diterima harus bilangan bulat Rupiah.").min(0),
});

const cancelOrderSchema = z.object({
  orderId: z.string().uuid("ID order tidak valid."),
  expectedVersion: z.number().int().min(1),
  reasonCategory: z.enum(["outlet_fault", "other"]),
  reason: z
    .string()
    .trim()
    .min(3, "Alasan pembatalan wajib diisi (minimal 3 karakter).")
    .max(240, "Alasan pembatalan maksimal 240 karakter."),
});

// ============================================================================
// TYPES UNTUK LAYAR KASIR & STRUK
// ============================================================================

export interface CashierOrderItemView {
  id: string;
  productId: string;
  productName: string;
  unitPrice: number;
  qty: number;
  note: string | null;
  lineTotal: number;
}

export interface CashierOrderCardView {
  id: string;
  orderNo: string;
  source: OrderSource;
  orderType: OrderType;
  tableId: string | null;
  tableNo: number | null;
  tableName: string;
  paymentChoice: PaymentMethod;
  customerClaimedPaidAt: string | null;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  discountReason: string | null;
  serviceRate: number | null;
  serviceAmount: number;
  taxRate: number | null;
  taxAmount: number;
  priceIncludesTax: boolean;
  total: number;
  version: number;
  expiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: CashierOrderItemView[];
  payment: {
    id: string;
    method: PaymentMethod;
    amountReceived: number;
    changeAmount: number;
    createdAt: string;
  } | null;
  refund: {
    id: string;
    amount: number;
    reasonCategory: RefundReasonCategory;
    reason: string;
    createdAt: string;
  } | null;
}

export interface CashierWorkspaceData {
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
    receiptFooter: string | null;
    taxConfig: TaxAndServiceConfig;
    maxCashierDiscountPercent: number | null;
    maxCashierDiscountAmount: number | null;
  };
  pendingOrders: CashierOrderCardView[];
  recentOrders: CashierOrderCardView[];
  categories: CategoryRow[];
  products: ProductRow[];
}

export interface OrderReceiptDetail {
  orderId: string;
  orderNo: string;
  outletName: string;
  outletAddress: string | null;
  receiptFooter: string | null;
  orderType: OrderType;
  tableName: string;
  status: OrderStatus;
  cashierName: string;
  paymentMethod: PaymentMethod;
  subtotal: number;
  discount: number;
  discountReason: string | null;
  serviceRate: number | null;
  serviceAmount: number;
  taxRate: number | null;
  taxAmount: number;
  priceIncludesTax: boolean;
  total: number;
  amountReceived: number;
  changeAmount: number;
  createdAt: string;
  paidAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  refund: {
    amount: number;
    reasonCategory: RefundReasonCategory;
    reason: string;
    createdAt: string;
  } | null;
  items: CashierOrderItemView[];
}

async function applyCashierAuditContext(
  allowedRoles: ReadonlyArray<UserRole>,
  reason: string
) {
  const staff = await requireStaffRole(allowedRoles);
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "cashier-browser";

  const admin = createSupabaseAdminClient();
  await admin.rpc("set_audit_context", {
    p_user_id: staff.userId,
    p_role: staff.role,
    p_device: device,
    p_ip: ip,
    p_reason: reason,
  });

  return { staff, admin, ip, device };
}

/**
 * Mengambil seluruh data yang dibutuhkan Layar Kasir:
 * - Order PENDING (urut dari yang terlama sesuai PRD 5.4)
 * - Order hari ini (PAID, READY, SERVED, CANCELLED)
 * - Produk & Kategori aktif untuk keperluan revisi item
 * - Batas diskon kasir & konfigurasi pajak outlet
 */
export async function getCashierWorkspaceData(): Promise<CashierWorkspaceData> {
  const staff = await requireStaffRole(["owner", "cashier"]);
  const admin = createSupabaseAdminClient();

  // 1. Kedaluwarsakan order PENDING yang sudah melewati expires_at lewat job server
  await runExpireOverdueOrdersJob();

  const [
    outletRes,
    pendingRes,
    recentRes,
    tablesRes,
    catRes,
    prodRes,
  ] = await Promise.all([
    admin.from("outlets").select("*").eq("id", staff.outletId).single(),
    admin
      .from("orders")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .eq("status", "pending")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("orders")
      .select("*")
      .eq("outlet_id", staff.outletId)
      .in("status", ["paid", "ready", "served", "cancelled", "expired"])
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    admin
      .from("tables")
      .select("id, table_no, name")
      .eq("outlet_id", staff.outletId),
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
  ]);

  const rawOutlet = (outletRes.data ?? {}) as Record<string, unknown>;
  const tableMap = new Map<string, { tableNo: number; name: string }>();
  for (const t of tablesRes.data ?? []) {
    tableMap.set(String(t.id), {
      tableNo: Number(t.table_no),
      name: String(t.name),
    });
  }

  const allRawOrders = [
    ...((pendingRes.data ?? []) as Array<Record<string, unknown>>),
    ...((recentRes.data ?? []) as Array<Record<string, unknown>>),
  ];
  const allOrderIds = allRawOrders.map((o) => String(o.id));

  const [itemsRes, paymentsRes, refundsRes, auditsRes] =
    allOrderIds.length > 0
      ? await Promise.all([
          admin
            .from("order_items")
            .select("*")
            .in("order_id", allOrderIds)
            .order("created_at", { ascending: true }),
          admin.from("payments").select("*").in("order_id", allOrderIds),
          admin.from("refunds").select("*").in("order_id", allOrderIds),
          admin
            .from("audit_logs")
            .select("entity_id, action, after, created_at")
            .eq("entity", "orders")
            .in("entity_id", allOrderIds)
            .in("action", [
              "order.customer_claimed_qris_paid",
              "order.payment_choice_selected",
              "payment.qris_verified",
            ])
            .order("id", { ascending: false }),
        ])
      : [
          { data: [] },
          { data: [] },
          { data: [] },
          { data: [] },
        ];

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

  const paymentMethodOverrideByOrder = new Map<string, PaymentMethod>();
  const claimedAtByOrder = new Map<string, string>();
  const choiceByOrder = new Map<string, PaymentMethod>();

  for (const a of (auditsRes.data ?? []) as Array<{
    entity_id: string;
    action: string;
    after: Record<string, unknown> | null;
    created_at: string;
  }>) {
    if (
      a.action === "order.customer_claimed_qris_paid" &&
      !claimedAtByOrder.has(a.entity_id)
    ) {
      claimedAtByOrder.set(a.entity_id, a.created_at);
    }
    if (
      a.action === "order.payment_choice_selected" &&
      !choiceByOrder.has(a.entity_id)
    ) {
      const ch = a.after?.payment_choice;
      if (ch === "qris" || ch === "cash") {
        choiceByOrder.set(a.entity_id, ch);
      }
    }
    if (
      a.action === "payment.qris_verified" &&
      !paymentMethodOverrideByOrder.has(a.entity_id)
    ) {
      paymentMethodOverrideByOrder.set(a.entity_id, "qris");
    }
  }

  const paymentByOrder = new Map<
    string,
    CashierOrderCardView["payment"]
  >();
  for (const p of (paymentsRes.data ?? []) as Array<Record<string, unknown>>) {
    const ordId = String(p.order_id);
    const rawMethod = (p.method as PaymentMethod) ?? "cash";
    const resolvedMethod = paymentMethodOverrideByOrder.get(ordId) ?? rawMethod;
    paymentByOrder.set(ordId, {
      id: String(p.id),
      method: resolvedMethod,
      amountReceived: Number(p.amount_received),
      changeAmount: Number(p.change_amount),
      createdAt: String(p.created_at),
    });
  }

  const refundByOrder = new Map<string, CashierOrderCardView["refund"]>();
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

  function mapOrderToCardView(
    raw: Record<string, unknown>
  ): CashierOrderCardView {
    const id = String(raw.id);
    const tableId = (raw.table_id as string | null) ?? null;
    const tbl = tableId ? tableMap.get(tableId) : undefined;
    const paymentChoice =
      (raw.payment_choice as PaymentMethod | undefined) ??
      choiceByOrder.get(id) ??
      "qris";
    const customerClaimedPaidAt =
      (raw.customer_claimed_paid_at as string | null | undefined) ??
      claimedAtByOrder.get(id) ??
      null;

    return {
      id,
      orderNo: String(raw.order_no),
      source: (raw.source as OrderSource) ?? "customer_qr",
      orderType: (raw.order_type as OrderType) ?? "dine_in",
      tableId,
      tableNo: tbl?.tableNo ?? null,
      tableName:
        tbl?.name ??
        (raw.order_type === "takeaway" ? "Takeaway / Bungkus" : "Tanpa Meja"),
      paymentChoice,
      customerClaimedPaidAt,
      status: raw.status as OrderStatus,
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
      version: Number(raw.version ?? 1),
      expiresAt: (raw.expires_at as string | null) ?? null,
      createdAt: String(raw.created_at),
      paidAt: (raw.paid_at as string | null) ?? null,
      readyAt: (raw.ready_at as string | null) ?? null,
      servedAt: (raw.served_at as string | null) ?? null,
      cancelledAt: (raw.cancelled_at as string | null) ?? null,
      cancelReason: (raw.cancel_reason as string | null) ?? null,
      items: itemsByOrder.get(id) ?? [],
      payment: paymentByOrder.get(id) ?? null,
      refund: refundByOrder.get(id) ?? null,
    };
  }

  return {
    staff: {
      userId: staff.userId,
      fullName: staff.fullName,
      role: staff.role,
      outletId: staff.outletId,
    },
    outlet: {
      id: String(rawOutlet.id ?? staff.outletId),
      name: String(rawOutlet.name ?? "Kafe Nusantara 1621"),
      address: (rawOutlet.address as string | null) ?? null,
      receiptFooter: (rawOutlet.receipt_footer as string | null) ?? null,
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
    },
    pendingOrders: ((pendingRes.data ?? []) as Array<Record<string, unknown>>).map(
      mapOrderToCardView
    ),
    recentOrders: ((recentRes.data ?? []) as Array<Record<string, unknown>>).map(
      mapOrderToCardView
    ),
    categories: (catRes.data ?? []) as CategoryRow[],
    products: (prodRes.data ?? []) as ProductRow[],
  };
}

/**
 * Server Action: Revisi daftar item pada order berstatus PENDING (Hanya Kasir/Owner).
 * Merekam kondisi daftar item sebelum dan sesudah revisi di audit_logs,
 * serta mengecek version (optimistic locking).
 */
export async function revisePendingOrderItemsAction(rawInput: {
  orderId: string;
  expectedVersion: number;
  reason: string;
  items: Array<{ productId: string; qty: number; note?: string | null }>;
}): Promise<ActionResult> {
  const parsed = reviseOrderItemsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data revisi tidak valid.",
    };
  }

  const { orderId, expectedVersion, reason, items } = parsed.data;
  const { staff, admin, ip, device } = await applyCashierAuditContext(
    ["owner", "cashier"],
    `Revisi item order oleh ${staffRoleLabel()}: ${reason}`
  );

  function staffRoleLabel() {
    return "Kasir";
  }

  // 1. Ambil order & pastikan masih PENDING serta version cocok
  const { data: orderRow, error: ordErr } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (ordErr || !orderRow) {
    return { ok: false, message: "Order tidak ditemukan." };
  }

  if (orderRow.status !== "pending") {
    return {
      ok: false,
      message: `Order tidak dapat direvisi karena statusnya sudah ${String(orderRow.status).toUpperCase()}.`,
    };
  }

  if (Number(orderRow.version) !== expectedVersion) {
    return {
      ok: false,
      message:
        "Order ini baru saja diubah atau dibayar oleh perangkat kasir lain. Silakan muat ulang.",
    };
  }

  const { data: beforeItems } = await admin
    .from("order_items")
    .select("product_id, product_name, unit_price, qty, note, line_total")
    .eq("order_id", orderId);

  // 2. Ambil data produk dari DB untuk harga snapshot yang sah
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { data: dbProducts } = await admin
    .from("products")
    .select("id, name, price, is_active, deleted_at")
    .eq("outlet_id", staff.outletId)
    .in("id", productIds);

  const prodMap = new Map<string, { name: string; price: number }>();
  for (const p of dbProducts ?? []) {
    if (p.is_active && p.deleted_at === null) {
      prodMap.set(String(p.id), {
        name: String(p.name),
        price: Number(p.price),
      });
    }
  }

  const nextItems: Array<{
    order_id: string;
    product_id: string;
    product_name: string;
    unit_price: number;
    qty: number;
    note: string | null;
    line_total: number;
  }> = [];

  for (const item of items) {
    const prod = prodMap.get(item.productId);
    if (!prod) {
      return {
        ok: false,
        message: "Salah satu produk tidak ditemukan atau sudah tidak aktif.",
      };
    }
    nextItems.push({
      order_id: orderId,
      product_id: item.productId,
      product_name: prod.name,
      unit_price: prod.price,
      qty: item.qty,
      note: item.note && item.note.length > 0 ? item.note : null,
      line_total: prod.price * item.qty,
    });
  }

  // 3. Hitung ulang total order berdasarkan konfigurasi pajak yang tersimpan di order
  const newSubtotal = nextItems.reduce((sum, i) => sum + i.line_total, 0);
  const cappedDiscount = Math.min(Number(orderRow.discount ?? 0), newSubtotal);

  const orderTaxConfig: TaxAndServiceConfig = {
    taxEnabled: orderRow.tax_rate !== null && Number(orderRow.tax_rate) > 0,
    taxPercent:
      orderRow.tax_rate !== null ? Number(orderRow.tax_rate) : null,
    serviceEnabled:
      orderRow.service_rate !== null && Number(orderRow.service_rate) > 0,
    servicePercent:
      orderRow.service_rate !== null ? Number(orderRow.service_rate) : null,
    priceIncludesTax: Boolean(orderRow.price_includes_tax),
  };

  const totals = calculateOrderTotals({
    items: nextItems.map((i) => ({
      unitPrice: i.unit_price,
      qty: i.qty,
    })),
    discount:
      cappedDiscount > 0
        ? { type: "amount", value: cappedDiscount }
        : { type: "none" },
    config: orderTaxConfig,
  });

  // 4. Update order dengan pengecekan version (optimistic locking)
  const { data: updatedOrder, error: updErr } = await admin
    .from("orders")
    .update({
      subtotal: totals.subtotal,
      discount: totals.discount,
      discount_reason:
        totals.discount > 0
          ? (orderRow.discount_reason as string | null) ?? reason
          : null,
      service_amount: totals.serviceAmount,
      tax_amount: totals.taxAmount,
      total: totals.total,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .eq("version", expectedVersion)
    .select("id, version")
    .maybeSingle();

  if (updErr || !updatedOrder) {
    return {
      ok: false,
      message:
        updErr?.message ??
        "Gagal merevisi order karena order sedang diubah oleh kasir lain.",
    };
  }

  // 5. Ganti baris order_items selama status masih pending
  const { error: delItemsErr } = await admin
    .from("order_items")
    .delete()
    .eq("order_id", orderId);

  if (delItemsErr) {
    return {
      ok: false,
      message: `Gagal memperbarui item lama: ${delItemsErr.message}`,
    };
  }

  const { error: insItemsErr } = await admin
    .from("order_items")
    .insert(nextItems);

  if (insItemsErr) {
    return {
      ok: false,
      message: `Gagal menyimpan item hasil revisi: ${insItemsErr.message}`,
    };
  }

  // 6. Catat ringkasan lengkap sebelum & sesudah revisi ke audit_logs
  await admin.from("audit_logs").insert({
    outlet_id: staff.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "order.revised_by_cashier",
    entity: "orders",
    entity_id: orderId,
    before: {
      subtotal: Number(orderRow.subtotal),
      total: Number(orderRow.total),
      items: beforeItems ?? [],
    },
    after: {
      subtotal: totals.subtotal,
      total: totals.total,
      items: nextItems,
    },
    reason,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/kasir");
  return {
    ok: true,
    message: `Revisi order #${orderRow.order_no} berhasil disimpan (Total baru: ${formatRupiah(totals.total)}).`,
  };
}

/**
 * Server Action: Berikan atau hapus diskon pada order PENDING dengan alasan wajib
 * dan pemeriksaan batas diskon kasir dari pengaturan outlet.
 */
export async function applyOrderDiscountAction(rawInput: {
  orderId: string;
  expectedVersion: number;
  discountType: "none" | "amount" | "percent";
  discountValue: number;
  reason: string;
}): Promise<ActionResult> {
  const parsed = applyDiscountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input diskon tidak valid.",
    };
  }

  const { orderId, expectedVersion, discountType, discountValue, reason } =
    parsed.data;

  if (discountType !== "none" && discountValue > 0 && reason.length < 3) {
    return {
      ok: false,
      message: "Alasan pemberian diskon wajib diisi (minimal 3 karakter).",
    };
  }

  const { staff, admin } = await applyCashierAuditContext(
    ["owner", "cashier"],
    discountType === "none" || discountValue === 0
      ? "Penghapusan diskon order"
      : `Pemberian diskon order: ${reason}`
  );

  const [{ data: orderRow }, { data: outletRow }, { data: orderItems }] =
    await Promise.all([
      admin
        .from("orders")
        .select("*")
        .eq("id", orderId)
        .eq("outlet_id", staff.outletId)
        .is("deleted_at", null)
        .maybeSingle(),
      admin.from("outlets").select("*").eq("id", staff.outletId).single(),
      admin
        .from("order_items")
        .select("unit_price, qty")
        .eq("order_id", orderId),
    ]);

  if (!orderRow) {
    return { ok: false, message: "Order tidak ditemukan." };
  }
  if (orderRow.status !== "pending") {
    return {
      ok: false,
      message: "Diskon hanya dapat diubah sebelum order dibayar (PENDING).",
    };
  }
  if (Number(orderRow.version) !== expectedVersion) {
    return {
      ok: false,
      message:
        "Order telah berubah di perangkat kasir lain. Silakan muat ulang.",
    };
  }

  const subtotal = Number(orderRow.subtotal ?? 0);
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

  // Cek batas maksimum diskon untuk role cashier
  if (staff.role === "cashier" && computedDiscount > 0 && outletRow) {
    const rawOutlet = outletRow as Record<string, unknown>;
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
        message: `Nominal diskon (${formatRupiah(computedDiscount)}) melebihi batas maksimum Kasir (${formatRupiah(maxAmt)}). Minta persetujuan Owner.`,
      };
    }

    if (maxPct !== null && subtotal > 0) {
      const effectivePct = (computedDiscount / subtotal) * 100;
      if (effectivePct > maxPct + 0.001) {
        return {
          ok: false,
          message: `Persentase diskon (${effectivePct.toFixed(1)}%) melebihi batas maksimum Kasir (${maxPct}%). Minta persetujuan Owner.`,
        };
      }
    }
  }

  const orderTaxConfig: TaxAndServiceConfig = {
    taxEnabled: orderRow.tax_rate !== null && Number(orderRow.tax_rate) > 0,
    taxPercent:
      orderRow.tax_rate !== null ? Number(orderRow.tax_rate) : null,
    serviceEnabled:
      orderRow.service_rate !== null && Number(orderRow.service_rate) > 0,
    servicePercent:
      orderRow.service_rate !== null ? Number(orderRow.service_rate) : null,
    priceIncludesTax: Boolean(orderRow.price_includes_tax),
  };

  const totals = calculateOrderTotals({
    items: ((orderItems ?? []) as Array<{ unit_price: number; qty: number }>).map(
      (i) => ({
        unitPrice: Number(i.unit_price),
        qty: Number(i.qty),
      })
    ),
    discount:
      computedDiscount > 0
        ? { type: "amount", value: computedDiscount }
        : { type: "none" },
    config: orderTaxConfig,
  });

  const { data: updated, error: updErr } = await admin
    .from("orders")
    .update({
      discount: totals.discount,
      discount_reason: totals.discount > 0 ? reason : null,
      service_amount: totals.serviceAmount,
      tax_amount: totals.taxAmount,
      total: totals.total,
    })
    .eq("id", orderId)
    .eq("status", "pending")
    .eq("version", expectedVersion)
    .select("id")
    .maybeSingle();

  if (updErr || !updated) {
    return {
      ok: false,
      message: updErr?.message ?? "Gagal menyimpan diskon.",
    };
  }

  revalidatePath("/kasir");
  return {
    ok: true,
    message:
      totals.discount > 0
        ? `Diskon ${formatRupiah(totals.discount)} berhasil diterapkan. Total baru: ${formatRupiah(totals.total)}.`
        : "Diskon dihapus.",
  };
}

/**
 * Server Action: Terima Pembayaran Order (Verifikasi QRIS "Pembayaran Sesuai" atau Bayar Tunai).
 * Menjamin HANYA SATU pembayaran sah per order (menggunakan pengecekan status = 'pending',
 * version = expectedVersion, dan constraint UNIQUE(order_id) pada tabel payments).
 */
export async function processOrderPaymentAction(rawInput: {
  orderId: string;
  expectedVersion: number;
  method: PaymentMethod;
  amountReceived: number;
}): Promise<ActionResult & { orderId?: string }> {
  const parsed = processPaymentSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Data pembayaran tidak valid.",
    };
  }

  const { orderId, expectedVersion, method, amountReceived } = parsed.data;
  const { staff, admin, ip, device } = await applyCashierAuditContext(
    ["owner", "cashier"],
    method === "qris"
      ? "Verifikasi Pembayaran Sesuai (QRIS)"
      : "Penerimaan Pembayaran Tunai"
  );

  // 1. Ambil order saat ini
  const { data: orderRow } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!orderRow) {
    return { ok: false, message: "Order tidak ditemukan." };
  }

  if (orderRow.status !== "pending") {
    return {
      ok: false,
      message: `Pembayaran ditolak: Order #${orderRow.order_no} sudah berstatus ${String(orderRow.status).toUpperCase()} (mungkin baru saja dibayar di perangkat kasir lain).`,
    };
  }

  if (
    orderRow.expires_at &&
    new Date(String(orderRow.expires_at)).getTime() <= Date.now()
  ) {
    await admin
      .from("orders")
      .update({ status: "expired" })
      .eq("id", orderId)
      .eq("status", "pending");

    return {
      ok: false,
      message: `Order #${orderRow.order_no} sudah melewati batas waktu 15 menit (EXPIRED).`,
    };
  }

  const total = Number(orderRow.total ?? 0);
  const effectiveReceived = method === "qris" ? total : amountReceived;

  let changeAmount = 0;
  try {
    changeAmount = calculateCashChange(total, effectiveReceived);
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Nominal uang diterima kurang dari total tagihan.",
    };
  }

  // 2. Atomic conditional UPDATE dengan pengecekan status = 'pending' DAN version = expectedVersion.
  //    Jika 5 kasir menekan tombol Bayar bersamaan, hanya 1 request yang berhasil meng-update baris ini!
  const paidAtIso = new Date().toISOString();
  const { data: lockedPaidOrder, error: lockErr } = await admin
    .from("orders")
    .update({
      status: "paid",
      paid_at: paidAtIso,
      paid_by: staff.userId,
    })
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .eq("status", "pending")
    .eq("version", expectedVersion)
    .select("id, order_no, version")
    .maybeSingle();

  if (lockErr || !lockedPaidOrder) {
    return {
      ok: false,
      message:
        "Pembayaran ganda ditolak: Order ini baru saja diproses atau direvisi oleh perangkat kasir lain.",
    };
  }

  // 3. Buat catatan di tabel payments (dilindungi UNIQUE(order_id))
  const { error: payErr } = await admin.from("payments").insert({
    order_id: orderId,
    method,
    amount_received: effectiveReceived,
    change_amount: changeAmount,
    created_by: staff.userId,
  });

  if (payErr) {
    // Jika enum 'qris' di database belum dijalankan lewat migrasi 0004, fallback ke 'cash' + log audit qris
    if (method === "qris" && payErr.message.includes("payment_method")) {
      const { error: fallbackPayErr } = await admin.from("payments").insert({
        order_id: orderId,
        method: "cash",
        amount_received: effectiveReceived,
        change_amount: changeAmount,
        created_by: staff.userId,
      });

      if (fallbackPayErr) {
        return {
          ok: false,
          message: `Pembayaran ditolak oleh database: ${fallbackPayErr.message}`,
        };
      }
    } else {
      return {
        ok: false,
        message: `Pembayaran ditolak: ${payErr.message}`,
      };
    }
  }

  if (method === "qris") {
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
      reason: `Kasir ${staff.fullName} menekan 'Pembayaran Sesuai' untuk QRIS sebesar ${formatRupiah(total)}`,
      prev_hash: "",
      hash: "",
    });
  }

  revalidatePath("/kasir");
  revalidatePath("/dapur");
  return {
    ok: true,
    orderId,
    message:
      method === "qris"
        ? `Pembayaran QRIS Order #${orderRow.order_no} (${formatRupiah(total)}) terverifikasi! Pesanan otomatis masuk ke Layar Dapur.`
        : `Pembayaran Tunai Order #${orderRow.order_no} berhasil! Kembalian: ${formatRupiah(changeAmount)}. Pesanan masuk ke Layar Dapur.`,
  };
}

/**
 * Server Action: Pembatalan Order & Refund Tunai (PRD Bagian 5.10).
 * - Order PENDING: bisa dibatalkan Kasir/Owner, alasan wajib, tanpa refund.
 * - Order PAID / READY: bisa dibatalkan Kasir/Owner, alasan wajib, otomatis membuat catatan refunds.
 * - Order SERVED: HANYA bisa dibatalkan oleh Owner, dan HANYA untuk kesalahan outlet (outlet_fault).
 */
export async function cancelOrderWithRefundAction(rawInput: {
  orderId: string;
  expectedVersion: number;
  reasonCategory: RefundReasonCategory;
  reason: string;
}): Promise<ActionResult> {
  const parsed = cancelOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Input pembatalan tidak valid.",
    };
  }

  const { orderId, expectedVersion, reasonCategory, reason } = parsed.data;
  const { staff, admin } = await applyCashierAuditContext(
    ["owner", "cashier"],
    `Pembatalan order (${reasonCategory}): ${reason}`
  );

  const { data: orderRow } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!orderRow) {
    return { ok: false, message: "Order tidak ditemukan." };
  }

  const currentStatus = orderRow.status as OrderStatus;
  if (currentStatus === "cancelled" || currentStatus === "expired") {
    return {
      ok: false,
      message: `Order sudah berstatus final (${currentStatus.toUpperCase()}).`,
    };
  }

  // Aturan Ketat PRD 5.10 untuk Order SERVED:
  if (currentStatus === "served") {
    if (staff.role !== "owner") {
      return {
        ok: false,
        message:
          "Order yang sudah disajikan (SERVED) hanya dapat dibatalkan oleh Owner.",
      };
    }
    if (reasonCategory !== "outlet_fault") {
      return {
        ok: false,
        message:
          "Order berstatus SERVED hanya boleh dibatalkan/di-refund jika terjadi Kesalahan Outlet (bukan kesalahan pelanggan).",
      };
    }
  }

  const cancelledAtIso = new Date().toISOString();
  const { data: cancelledOrder, error: cancelErr } = await admin
    .from("orders")
    .update({
      status: "cancelled",
      cancelled_at: cancelledAtIso,
      cancelled_by: staff.userId,
      cancel_reason: reason,
    })
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .eq("version", expectedVersion)
    .select("id, order_no, total")
    .maybeSingle();

  if (cancelErr || !cancelledOrder) {
    return {
      ok: false,
      message:
        cancelErr?.message ??
        "Gagal membatalkan order (mungkin status telah berubah di perangkat lain).",
    };
  }

  // Jika order sebelumnya sudah dibayar (PAID, READY, atau SERVED), wajib buat catatan refund
  if (
    currentStatus === "paid" ||
    currentStatus === "ready" ||
    currentStatus === "served"
  ) {
    const { data: paymentRow } = await admin
      .from("payments")
      .select("id")
      .eq("order_id", orderId)
      .maybeSingle();

    if (paymentRow) {
      const { error: refundErr } = await admin.from("refunds").insert({
        order_id: orderId,
        payment_id: paymentRow.id,
        amount: Number(orderRow.total),
        reason_category: reasonCategory,
        reason,
        created_by: staff.userId,
      });

      if (refundErr) {
        return {
          ok: false,
          message: `Order dibatalkan, namun gagal mencatat refund: ${refundErr.message}`,
        };
      }
    }
  }

  revalidatePath("/kasir");
  revalidatePath("/dapur");
  revalidatePath("/dashboard/transaksi");
  return {
    ok: true,
    message:
      currentStatus === "pending"
        ? `Order #${orderRow.order_no} berhasil dibatalkan.`
        : `Order #${orderRow.order_no} dibatalkan dan Refund sebesar ${formatRupiah(Number(orderRow.total))} telah dicatat.`,
  };
}

/**
 * Mengambil detail lengkap untuk halaman cetak struk /struk/[orderId].
 */
export async function getOrderReceiptDetail(
  rawOrderId: string
): Promise<OrderReceiptDetail | null> {
  const staff = await requireStaffRole(["owner", "cashier"]);
  const parsedId = z.string().uuid().safeParse(rawOrderId);
  if (!parsedId.success) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const orderId = parsedId.data;

  const { data: orderRow } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!orderRow) {
    return null;
  }

  const [
    { data: outletRow },
    { data: tableRow },
    { data: itemsData },
    { data: paymentRow },
    { data: refundRow },
    { data: cashierProfile },
    { data: qrisAudit },
  ] = await Promise.all([
    admin.from("outlets").select("*").eq("id", staff.outletId).single(),
    orderRow.table_id
      ? admin
          .from("tables")
          .select("name")
          .eq("id", orderRow.table_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("order_items")
      .select("*")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    admin.from("payments").select("*").eq("order_id", orderId).maybeSingle(),
    admin.from("refunds").select("*").eq("order_id", orderId).maybeSingle(),
    orderRow.paid_by
      ? admin
          .from("profiles")
          .select("full_name")
          .eq("id", orderRow.paid_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("audit_logs")
      .select("action")
      .eq("entity", "orders")
      .eq("entity_id", orderId)
      .eq("action", "payment.qris_verified")
      .limit(1),
  ]);

  const rawPaymentMethod =
    (paymentRow?.method as PaymentMethod | undefined) ??
    ((orderRow as Record<string, unknown>).payment_choice as
      | PaymentMethod
      | undefined) ??
    "cash";
  const resolvedPaymentMethod: PaymentMethod =
    (qrisAudit?.length ?? 0) > 0 ? "qris" : rawPaymentMethod;

  const total = Number(orderRow.total ?? 0);

  return {
    orderId,
    orderNo: String(orderRow.order_no),
    outletName: String(outletRow?.name ?? "Kafe Nusantara 1621"),
    outletAddress: (outletRow?.address as string | null) ?? null,
    receiptFooter: (outletRow?.receipt_footer as string | null) ?? null,
    orderType: (orderRow.order_type as OrderType) ?? "dine_in",
    tableName:
      tableRow?.name ??
      (orderRow.order_type === "takeaway" ? "Takeaway / Bungkus" : "-"),
    status: orderRow.status as OrderStatus,
    cashierName: String(cashierProfile?.full_name ?? staff.fullName),
    paymentMethod: resolvedPaymentMethod,
    subtotal: Number(orderRow.subtotal ?? 0),
    discount: Number(orderRow.discount ?? 0),
    discountReason: (orderRow.discount_reason as string | null) ?? null,
    serviceRate:
      orderRow.service_rate !== null && orderRow.service_rate !== undefined
        ? Number(orderRow.service_rate)
        : null,
    serviceAmount: Number(orderRow.service_amount ?? 0),
    taxRate:
      orderRow.tax_rate !== null && orderRow.tax_rate !== undefined
        ? Number(orderRow.tax_rate)
        : null,
    taxAmount: Number(orderRow.tax_amount ?? 0),
    priceIncludesTax: Boolean(orderRow.price_includes_tax),
    total,
    amountReceived: Number(paymentRow?.amount_received ?? total),
    changeAmount: Number(paymentRow?.change_amount ?? 0),
    createdAt: String(orderRow.created_at),
    paidAt: (orderRow.paid_at as string | null) ?? null,
    cancelledAt: (orderRow.cancelled_at as string | null) ?? null,
    cancelReason: (orderRow.cancel_reason as string | null) ?? null,
    refund: refundRow
      ? {
          amount: Number(refundRow.amount),
          reasonCategory:
            (refundRow.reason_category as RefundReasonCategory) ?? "other",
          reason: String(refundRow.reason ?? ""),
          createdAt: String(refundRow.created_at),
        }
      : null,
    items: ((itemsData ?? []) as OrderItemRow[]).map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      unitPrice: Number(i.unit_price),
      qty: Number(i.qty),
      note: i.note ?? null,
      lineTotal: Number(i.line_total),
    })),
  };
}

/**
 * Server Action: Mencatat cetak ulang struk ke audit_logs (PRD Bagian 5.5 & 5.11).
 */
export async function recordReceiptReprintAction(rawInput: {
  orderId: string;
}): Promise<ActionResult> {
  const parsedId = z.string().uuid().safeParse(rawInput.orderId);
  if (!parsedId.success) {
    return { ok: false, message: "ID order tidak valid." };
  }

  const { staff, admin, ip, device } = await applyCashierAuditContext(
    ["owner", "cashier"],
    "Cetak ulang struk pembayaran"
  );

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, order_no, total")
    .eq("id", parsedId.data)
    .eq("outlet_id", staff.outletId)
    .maybeSingle();

  if (!orderRow) {
    return { ok: false, message: "Order tidak ditemukan." };
  }

  await admin.from("audit_logs").insert({
    outlet_id: staff.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "receipt.reprinted",
    entity: "orders",
    entity_id: orderRow.id,
    before: null,
    after: {
      order_no: orderRow.order_no,
      total: Number(orderRow.total),
      reprinted_by: staff.fullName,
    },
    reason: `Cetak ulang struk Order #${orderRow.order_no} oleh ${staff.fullName}`,
    prev_hash: "",
    hash: "",
  });

  return {
    ok: true,
    message: `Cetak struk Order #${orderRow.order_no} dicatat di Jejak Audit.`,
  };
}

