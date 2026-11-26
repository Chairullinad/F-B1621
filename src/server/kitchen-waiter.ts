"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  OrderStatus,
  OrderType,
  UserRole,
} from "@/lib/types/database";
import type { OrderReceiptDetail } from "@/server/cashier";
import { requireStaffRole, type ActionResult } from "@/server/auth";

// ============================================================================
// ZOD SCHEMAS (Validasi Server sesuai AGENTS.md)
// ============================================================================

const transitionOrderStatusSchema = z.object({
  orderId: z.string().uuid("ID order tidak valid."),
  expectedVersion: z.number().int().min(1),
});

// ============================================================================
// TYPES (Tanpa Harga atau Data Pembayaran sesuai PRD 5.8 & 5.9)
// ============================================================================

export interface OperationalTicketItemView {
  id: string;
  productName: string;
  qty: number;
  note: string | null;
}

export interface KitchenTicketView {
  id: string;
  orderNo: string;
  orderType: OrderType;
  tableNo: number | null;
  tableName: string;
  status: Extract<OrderStatus, "paid" | "ready" | "cancelled">;
  cookingStartedAt: string | null;
  version: number;
  paidAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  items: OperationalTicketItemView[];
}

export interface KitchenWorkspaceData {
  staff: {
    userId: string;
    fullName: string;
    role: UserRole;
    outletId: string;
  };
  paidTickets: KitchenTicketView[];
  readyCount: number;
  recentCancelledPaidTickets: KitchenTicketView[];
}

export interface WaiterTicketView {
  id: string;
  orderNo: string;
  orderType: OrderType;
  tableNo: number | null;
  tableName: string;
  version: number;
  paidAt: string | null;
  readyAt: string;
  items: OperationalTicketItemView[];
}

export interface WaiterWorkspaceData {
  staff: {
    userId: string;
    fullName: string;
    role: UserRole;
    outletId: string;
  };
  readyTickets: WaiterTicketView[];
}

async function applyOperationalAuditContext(
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
  const device = hdrs.get("user-agent") ?? "operational-browser";

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
 * Mengambil seluruh tiket untuk Layar Dapur (/dapur):
 * - Order berstatus PAID (urut paid_at terlama ke terbaru)
 * - Order yang sudah sempat PAID namun dibatalkan kasir (CANCELLED) dalam 30 menit terakhir
 * - TIDAK menyertakan harga satuan, subtotal, total, atau metode pembayaran (PRD 5.8).
 */
export async function getKitchenWorkspaceData(): Promise<KitchenWorkspaceData> {
  const staff = await requireStaffRole(["owner", "kitchen", "cashier"], "dapur");
  const admin = createSupabaseAdminClient();

  const thirtyMinsAgoIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();

  const [paidRes, readyCountRes, cancelledRes, tablesRes] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, order_no, order_type, table_id, status, cooking_started_at, version, paid_at, created_at, cancelled_at, cancel_reason"
      )
      .eq("outlet_id", staff.outletId)
      .eq("status", "paid")
      .is("deleted_at", null)
      .order("paid_at", { ascending: true }),
    admin
      .from("orders")
      .select("id", { count: "exact", head: true })
      .eq("outlet_id", staff.outletId)
      .eq("status", "ready")
      .is("deleted_at", null),
    admin
      .from("orders")
      .select(
        "id, order_no, order_type, table_id, status, cooking_started_at, version, paid_at, created_at, cancelled_at, cancel_reason"
      )
      .eq("outlet_id", staff.outletId)
      .eq("status", "cancelled")
      .not("paid_at", "is", null)
      .gte("cancelled_at", thirtyMinsAgoIso)
      .is("deleted_at", null)
      .order("cancelled_at", { ascending: false }),
    admin
      .from("tables")
      .select("id, table_no, name")
      .eq("outlet_id", staff.outletId),
  ]);

  const tableMap = new Map<string, { tableNo: number; name: string }>();
  for (const t of tablesRes.data ?? []) {
    tableMap.set(String(t.id), {
      tableNo: Number(t.table_no),
      name: String(t.name),
    });
  }

  const allRawOrders = [
    ...((paidRes.data ?? []) as Array<Record<string, unknown>>),
    ...((cancelledRes.data ?? []) as Array<Record<string, unknown>>),
  ];
  const orderIds = allRawOrders.map((o) => String(o.id));

  // Hanya ambil id, order_id, product_name, qty, note (TANPA unit_price / line_total)
  const { data: rawItems } =
    orderIds.length > 0
      ? await admin
          .from("order_items")
          .select("id, order_id, product_name, qty, note")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const itemsByOrder = new Map<string, OperationalTicketItemView[]>();
  for (const item of (rawItems ?? []) as Array<{
    id: string;
    order_id: string;
    product_name: string;
    qty: number;
    note: string | null;
  }>) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({
      id: item.id,
      productName: item.product_name,
      qty: Number(item.qty),
      note: item.note ?? null,
    });
    itemsByOrder.set(item.order_id, list);
  }

  function mapKitchenTicket(raw: Record<string, unknown>): KitchenTicketView {
    const id = String(raw.id);
    const tableId = (raw.table_id as string | null) ?? null;
    const tbl = tableId ? tableMap.get(tableId) : undefined;
    return {
      id,
      orderNo: String(raw.order_no),
      orderType: (raw.order_type as OrderType) ?? "dine_in",
      tableNo: tbl?.tableNo ?? null,
      tableName:
        tbl?.name ??
        (raw.order_type === "takeaway" ? "Takeaway / Bungkus" : "Tanpa Meja"),
      status: raw.status === "cancelled" ? "cancelled" : "paid",
      cookingStartedAt: (raw.cooking_started_at as string | null) ?? null,
      version: Number(raw.version ?? 1),
      paidAt: String(raw.paid_at ?? raw.created_at),
      cancelledAt: (raw.cancelled_at as string | null) ?? null,
      cancelReason: (raw.cancel_reason as string | null) ?? null,
      items: itemsByOrder.get(id) ?? [],
    };
  }

  return {
    staff: {
      userId: staff.userId,
      fullName: staff.fullName,
      role: staff.role,
      outletId: staff.outletId,
    },
    paidTickets: (
      (paidRes.data ?? []) as Array<Record<string, unknown>>
    ).map(mapKitchenTicket),
    readyCount: readyCountRes.count ?? 0,
    recentCancelledPaidTickets: (
      (cancelledRes.data ?? []) as Array<Record<string, unknown>>
    ).map(mapKitchenTicket),
  };
}

/**
 * Server Action Dapur: Menandai order mulai dimasak (cooking_started_at).
 */
export async function startOrderCookingAction(rawInput: {
  orderId: string;
}): Promise<ActionResult> {
  const parsed = z.object({ orderId: z.string().uuid() }).safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "ID order tidak valid." };
  }

  const { staff, admin } = await applyOperationalAuditContext(
    ["owner", "kitchen", "cashier"],
    "Dapur menekan tombol Mulai Masak (Cooking)"
  );

  const { error } = await admin
    .from("orders")
    .update({
      cooking_started_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.orderId)
    .eq("outlet_id", staff.outletId)
    .eq("status", "paid");

  if (error) {
    return { ok: false, message: `Gagal memulai masak: ${error.message}` };
  }

  revalidatePath("/dapur");
  return {
    ok: true,
    message: "Status tiket diubah menjadi Sedang Dimasak.",
  };
}

/**
 * Server Action Dapur: Menandai order berstatus PAID menjadi READY (Siap Diantar).
 */
export async function markOrderReadyAction(rawInput: {
  orderId: string;
  expectedVersion: number;
}): Promise<ActionResult> {
  const parsed = transitionOrderStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }

  const { orderId, expectedVersion } = parsed.data;
  const { staff, admin, ip, device } = await applyOperationalAuditContext(
    ["owner", "kitchen", "cashier"],
    `Kitchen menandai pesanan siap diantar (READY)`
  );

  const readyAtIso = new Date().toISOString();
  const { data: updated, error: updErr } = await admin
    .from("orders")
    .update({
      status: "ready",
      ready_at: readyAtIso,
    })
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .eq("status", "paid")
    .eq("version", expectedVersion)
    .select("id, order_no")
    .maybeSingle();

  if (updErr || !updated) {
    return {
      ok: false,
      message:
        updErr?.message ??
        "Order ini sudah ditandai siap atau telah dibatalkan oleh kasir.",
    };
  }

  await admin.from("audit_logs").insert({
    outlet_id: staff.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "order.marked_ready_by_kitchen",
    entity: "orders",
    entity_id: orderId,
    before: { status: "paid" },
    after: {
      status: "ready",
      ready_at: readyAtIso,
      ready_by_name: staff.fullName,
    },
    reason: `Dapur (${staff.fullName}) menandai Order #${updated.order_no} siap diantar (READY).`,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/dapur");
  revalidatePath("/antar");
  revalidatePath("/kasir");

  return {
    ok: true,
    message: `Order #${updated.order_no} ditandai SIAP DIANTAR (READY) dan masuk ke Layar Pelayan.`,
  };
}

/**
 * Mengambil seluruh tiket untuk Layar Antar Pelayan (/antar):
 * - Order berstatus READY (urut ready_at terlama ke terbaru)
 * - TIDAK menyertakan harga atau data pembayaran (PRD 5.9).
 */
export async function getWaiterWorkspaceData(): Promise<WaiterWorkspaceData> {
  const staff = await requireStaffRole(["owner", "waiter", "cashier", "kitchen"], "antar");
  const admin = createSupabaseAdminClient();

  const [readyRes, tablesRes] = await Promise.all([
    admin
      .from("orders")
      .select(
        "id, order_no, order_type, table_id, version, paid_at, ready_at, created_at"
      )
      .eq("outlet_id", staff.outletId)
      .eq("status", "ready")
      .is("deleted_at", null)
      .order("ready_at", { ascending: true }),
    admin
      .from("tables")
      .select("id, table_no, name")
      .eq("outlet_id", staff.outletId),
  ]);

  const tableMap = new Map<string, { tableNo: number; name: string }>();
  for (const t of tablesRes.data ?? []) {
    tableMap.set(String(t.id), {
      tableNo: Number(t.table_no),
      name: String(t.name),
    });
  }

  const rawOrders = (readyRes.data ?? []) as Array<Record<string, unknown>>;
  const orderIds = rawOrders.map((o) => String(o.id));

  const { data: rawItems } =
    orderIds.length > 0
      ? await admin
          .from("order_items")
          .select("id, order_id, product_name, qty, note")
          .in("order_id", orderIds)
          .order("created_at", { ascending: true })
      : { data: [] };

  const itemsByOrder = new Map<string, OperationalTicketItemView[]>();
  for (const item of (rawItems ?? []) as Array<{
    id: string;
    order_id: string;
    product_name: string;
    qty: number;
    note: string | null;
  }>) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push({
      id: item.id,
      productName: item.product_name,
      qty: Number(item.qty),
      note: item.note ?? null,
    });
    itemsByOrder.set(item.order_id, list);
  }

  return {
    staff: {
      userId: staff.userId,
      fullName: staff.fullName,
      role: staff.role,
      outletId: staff.outletId,
    },
    readyTickets: rawOrders.map((raw) => {
      const id = String(raw.id);
      const tableId = (raw.table_id as string | null) ?? null;
      const tbl = tableId ? tableMap.get(tableId) : undefined;
      return {
        id,
        orderNo: String(raw.order_no),
        orderType: (raw.order_type as OrderType) ?? "dine_in",
        tableNo: tbl?.tableNo ?? null,
        tableName:
          tbl?.name ??
          (raw.order_type === "takeaway" ? "Takeaway / Bungkus" : "Tanpa Meja"),
        version: Number(raw.version ?? 1),
        paidAt: (raw.paid_at as string | null) ?? null,
        readyAt: String(raw.ready_at ?? raw.created_at),
        items: itemsByOrder.get(id) ?? [],
      };
    }),
  };
}

/**
 * Server Action Pelayan: Menandai order berstatus READY menjadi SERVED (Sudah Diantar).
 * Begitu berstatus SERVED, sesi pemantauan order pelanggan pada /m/[token] otomatis berakhir (expired).
 */
export async function markOrderServedAction(rawInput: {
  orderId: string;
  expectedVersion: number;
}): Promise<ActionResult> {
  const parsed = transitionOrderStatusSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Input tidak valid.",
    };
  }

  const { orderId, expectedVersion } = parsed.data;
  const { staff, admin, ip, device } = await applyOperationalAuditContext(
    ["owner", "waiter", "cashier"],
    `Pelayan menandai pesanan sudah diantar ke meja (SERVED)`
  );

  const servedAtIso = new Date().toISOString();
  const { data: updated, error: updErr } = await admin
    .from("orders")
    .update({
      status: "served",
      served_at: servedAtIso,
      served_by: staff.userId,
    })
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .eq("status", "ready")
    .eq("version", expectedVersion)
    .select("id, order_no, table_id")
    .maybeSingle();

  if (updErr || !updated) {
    return {
      ok: false,
      message:
        updErr?.message ??
        "Order ini sudah ditandai selesai oleh pelayan lain.",
    };
  }

  // Catat pengakhiran otomatis sesi pantau layar pelanggan saat pesanan telah disajikan
  await admin.from("audit_logs").insert({
    outlet_id: staff.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "order.customer_session_expired_on_served",
    entity: "orders",
    entity_id: orderId,
    before: { status: "ready", session_expired: false },
    after: {
      status: "served",
      served_at: servedAtIso,
      served_by: staff.fullName,
      session_expired: true,
    },
    reason: `Pesanan #${updated.order_no} telah disajikan oleh ${staff.fullName}; sesi pantau pelanggan berakhir otomatis.`,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/antar");
  revalidatePath("/kasir");
  revalidatePath("/dashboard/transaksi");

  return {
    ok: true,
    message: `Order #${updated.order_no} selesai disajikan (SERVED). Sesi pantau pelanggan pada meja tersebut otomatis ditutup.`,
  };
}

/**
 * Mengambil detail tiket order KHUSUS Kitchen (/dapur/struk/[orderId])
 * tanpa menyertakan harga, diskon, pajak, total, atau nominal pembayaran (PRD 5.8).
 */
export async function getKitchenTicketPrintDetail(
  rawOrderId: string
): Promise<OrderReceiptDetail | null> {
  const staff = await requireStaffRole(["owner", "kitchen", "cashier"], "dapur");
  const parsedId = z.string().uuid().safeParse(rawOrderId);
  if (!parsedId.success) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const orderId = parsedId.data;

  const { data: orderRow } = await admin
    .from("orders")
    .select(
      "id, outlet_id, order_no, order_type, table_id, status, created_at, paid_at, paid_by, cancelled_at, cancel_reason"
    )
    .eq("id", orderId)
    .eq("outlet_id", staff.outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!orderRow) {
    return null;
  }

  const [outletRes, tableRes, itemsRes, cashierRes] = await Promise.all([
    admin
      .from("outlets")
      .select("name, address")
      .eq("id", staff.outletId)
      .maybeSingle(),
    orderRow.table_id
      ? admin
          .from("tables")
          .select("name")
          .eq("id", orderRow.table_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("order_items")
      .select("id, product_id, product_name, qty, note")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    orderRow.paid_by
      ? admin
          .from("users")
          .select("full_name")
          .eq("id", orderRow.paid_by)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const rawItems = (itemsRes.data ?? []) as Array<{
    id: string;
    product_id: string;
    product_name: string;
    qty: number;
    note: string | null;
  }>;

  return {
    orderId,
    orderNo: String(orderRow.order_no),
    outletName: String(outletRes.data?.name ?? "1621 GROUP"),
    outletAddress: (outletRes.data?.address as string | null) ?? null,
    receiptFooter: null,
    wifiName: null,
    wifiPassword: null,
    orderType: (orderRow.order_type as OrderType) ?? "dine_in",
    tableName:
      tableRes.data?.name ??
      (orderRow.order_type === "takeaway" ? "Takeaway / Bungkus" : "-"),
    status: orderRow.status as OrderStatus,
    cashierName: String(cashierRes.data?.full_name ?? staff.fullName),
    paymentMethod: "cash",
    subtotal: 0,
    discount: 0,
    discountReason: null,
    serviceRate: null,
    serviceAmount: 0,
    taxRate: null,
    taxAmount: 0,
    priceIncludesTax: false,
    total: 0,
    amountReceived: 0,
    changeAmount: 0,
    createdAt: String(orderRow.created_at),
    paidAt: (orderRow.paid_at as string | null) ?? null,
    cancelledAt: (orderRow.cancelled_at as string | null) ?? null,
    cancelReason: (orderRow.cancel_reason as string | null) ?? null,
    refund: null,
    items: rawItems.map((i) => ({
      id: i.id,
      productId: i.product_id,
      productName: i.product_name,
      unitPrice: 0,
      qty: Number(i.qty),
      note: i.note ?? null,
      lineTotal: 0,
    })),
  };
}

/**
 * Server Action: Mencatat cetak tiket antrean dari Layar Kitchen ke audit_logs.
 */
export async function recordKitchenTicketPrintAction(rawInput: {
  orderId: string;
}): Promise<ActionResult> {
  const parsedId = z.string().uuid().safeParse(rawInput.orderId);
  if (!parsedId.success) {
    return { ok: false, message: "ID order tidak valid." };
  }

  const staff = await requireStaffRole(
    ["owner", "kitchen", "cashier"],
    "dapur"
  );
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "kitchen-browser";
  const admin = createSupabaseAdminClient();

  const { data: orderRow } = await admin
    .from("orders")
    .select("id, outlet_id, order_no")
    .eq("id", parsedId.data)
    .eq("outlet_id", staff.outletId)
    .maybeSingle();

  if (!orderRow) {
    return { ok: false, message: "Order tidak ditemukan." };
  }

  const reason = `Cetak tiket kitchen Order #${orderRow.order_no} oleh ${staff.fullName}`;
  await admin.rpc("set_audit_context", {
    p_user_id: staff.userId,
    p_role: staff.role,
    p_device: device,
    p_ip: ip,
    p_reason: reason,
  });

  await admin.from("audit_logs").insert({
    outlet_id: staff.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "kitchen_ticket.printed",
    entity: "orders",
    entity_id: orderRow.id,
    before: null,
    after: {
      order_no: orderRow.order_no,
      printed_by: staff.fullName,
    },
    reason,
    prev_hash: "",
    hash: "",
  });

  return {
    ok: true,
    message: `Cetak tiket kitchen Order #${orderRow.order_no} dicatat di Jejak Audit.`,
  };
}

