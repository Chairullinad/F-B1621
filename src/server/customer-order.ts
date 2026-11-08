"use server";

import { headers } from "next/headers";
import { z } from "zod";
import { getTodayPrefixWIB } from "@/lib/datetime";
import { calculateOrderTotals, type TaxAndServiceConfig } from "@/lib/money";
import { generateQrSvgString } from "@/lib/qrcode";
import { generateDynamicQrisPayload } from "@/lib/qris";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  CategoryRow,
  OrderItemRow,
  OrderStatus,
  PaymentMethod,
  ProductRow,
} from "@/lib/types/database";

const DEFAULT_FALLBACK_STATIC_QRIS =
  "00020101021126650014ID.CO.QRIS.WWW01189360050300000898240214123456789012340303UMI5204581253033605802ID5919KAFE NUSANTARA 16216007JAKARTA6105101106304A1B2";

const MAX_PENDING_ORDERS_PER_TABLE = 3;
const MAX_DISTINCT_ITEMS_PER_ORDER = 25;
const MAX_QTY_PER_ITEM = 50;

const qrTokenSchema = z
  .string()
  .trim()
  .min(16, "Token QR meja tidak valid.")
  .max(128, "Token QR meja tidak valid.");

const createCustomerOrderSchema = z.object({
  qrToken: qrTokenSchema,
  paymentChoice: z.enum(["qris", "cash"]),
  idempotencyKey: z
    .string()
    .trim()
    .min(8, "Idempotency key tidak valid.")
    .max(120, "Idempotency key terlalu panjang."),
  items: z
    .array(
      z.object({
        productId: z.string().uuid("ID produk tidak valid."),
        qty: z
          .number()
          .int("Jumlah item harus bilangan bulat.")
          .min(1, "Jumlah minimal 1.")
          .max(
            MAX_QTY_PER_ITEM,
            `Maksimal ${MAX_QTY_PER_ITEM} porsi per item.`
          ),
        note: z
          .string()
          .trim()
          .max(160, "Catatan item maksimal 160 karakter.")
          .nullable()
          .optional(),
      })
    )
    .min(1, "Keranjang pesanan tidak boleh kosong.")
    .max(
      MAX_DISTINCT_ITEMS_PER_ORDER,
      `Maksimal ${MAX_DISTINCT_ITEMS_PER_ORDER} jenis menu per pesanan.`
    ),
});

export interface CustomerTablePublicData {
  table: {
    id: string;
    tableNo: number;
    name: string;
    qrToken: string;
  };
  outlet: {
    id: string;
    name: string;
    address: string | null;
    orderExpiryMinutes: number;
    taxConfig: TaxAndServiceConfig;
    qrisMerchantName: string;
  };
  categories: CategoryRow[];
  products: ProductRow[];
}

export interface CustomerOrderTrackingView {
  orderId: string;
  orderNo: string;
  tableNo: number;
  tableName: string;
  outletName: string;
  qrisMerchantName: string;
  paymentChoice: PaymentMethod;
  status: OrderStatus;
  subtotal: number;
  discount: number;
  serviceRate: number | null;
  serviceAmount: number;
  taxRate: number | null;
  taxAmount: number;
  priceIncludesTax: boolean;
  total: number;
  expiresAt: string | null;
  createdAt: string;
  paidAt: string | null;
  readyAt: string | null;
  servedAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  customerClaimedPaidAt: string | null;
  sessionExpired: boolean;
  qrisSvg: string | null;
  items: Array<
    Pick<
      OrderItemRow,
      "id" | "product_name" | "unit_price" | "qty" | "note" | "line_total"
    >
  >;
}

export interface CreateCustomerOrderResult {
  ok: boolean;
  message: string;
  order?: CustomerOrderTrackingView;
}

async function getCustomerRequestMeta(): Promise<{ ip: string; device: string }> {
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "customer-browser";
  return { ip, device };
}

/**
 * Mengambil data meja, konfigurasi outlet, kategori, dan produk aktif
 * berdasarkan qr_token. Halaman pelanggan TIDAK pernah mengakses tabel langsung.
 */
export async function getCustomerTableMenuByToken(
  rawToken: string
): Promise<CustomerTablePublicData | null> {
  const parsedToken = qrTokenSchema.safeParse(rawToken);
  if (!parsedToken.success) {
    return null;
  }

  const admin = createSupabaseAdminClient();
  const { data: tableRow, error: tableErr } = await admin
    .from("tables")
    .select("id, outlet_id, table_no, name, qr_token, is_active, deleted_at")
    .eq("qr_token", parsedToken.data)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (tableErr || !tableRow) {
    return null;
  }

  const [outletRes, catRes, prodRes] = await Promise.all([
    admin
      .from("outlets")
      .select("*")
      .eq("id", tableRow.outlet_id)
      .is("deleted_at", null)
      .single(),
    admin
      .from("categories")
      .select("*")
      .eq("outlet_id", tableRow.outlet_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("products")
      .select("*")
      .eq("outlet_id", tableRow.outlet_id)
      .eq("is_active", true)
      .is("deleted_at", null)
      .order("name", { ascending: true }),
  ]);

  if (outletRes.error || !outletRes.data) {
    return null;
  }

  const rawOutlet = outletRes.data as Record<string, unknown>;

  return {
    table: {
      id: String(tableRow.id),
      tableNo: Number(tableRow.table_no),
      name: String(tableRow.name),
      qrToken: String(tableRow.qr_token),
    },
    outlet: {
      id: String(rawOutlet.id),
      name: String(rawOutlet.name ?? "Outlet"),
      address: (rawOutlet.address as string | null) ?? null,
      orderExpiryMinutes: Number(rawOutlet.order_expiry_minutes ?? 15),
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
      qrisMerchantName: String(
        (rawOutlet.qris_merchant_name as string | null) ??
          rawOutlet.name ??
          "KAFE NUSANTARA 1621"
      ),
    },
    categories: (catRes.data ?? []) as CategoryRow[],
    products: (prodRes.data ?? []) as ProductRow[],
  };
}

/**
 * Helper pembuat nomor order berurutan per outlet per hari (contoh: 20261107-0001).
 */
async function generateNextOrderNo(outletId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  const prefix = getTodayPrefixWIB(new Date());

  const { data: latestOrders } = await admin
    .from("orders")
    .select("order_no")
    .eq("outlet_id", outletId)
    .like("order_no", `${prefix}-%`)
    .order("order_no", { ascending: false })
    .limit(1);

  const latestOrderNo = latestOrders?.[0]?.order_no;
  let nextSeq = 1;

  if (latestOrderNo) {
    const parts = latestOrderNo.split("-");
    const lastNumber = Number.parseInt(parts[1] ?? "0", 10);
    if (Number.isFinite(lastNumber) && lastNumber >= 1) {
      nextSeq = lastNumber + 1;
    }
  }

  return `${prefix}-${String(nextSeq).padStart(4, "0")}`;
}

/**
 * Membangun objek CustomerOrderTrackingView untuk dikembalikan ke layar pelanggan.
 */
async function buildCustomerOrderTrackingView(params: {
  orderRecord: Record<string, unknown>;
  tableNo: number;
  tableName: string;
  outletRecord: Record<string, unknown>;
}): Promise<CustomerOrderTrackingView> {
  const admin = createSupabaseAdminClient();
  const orderId = String(params.orderRecord.id);

  const [{ data: itemsData }, { data: claimAuditData }] = await Promise.all([
    admin
      .from("order_items")
      .select("id, product_name, unit_price, qty, note, line_total")
      .eq("order_id", orderId)
      .order("created_at", { ascending: true }),
    admin
      .from("audit_logs")
      .select("action, after, created_at")
      .eq("entity", "orders")
      .eq("entity_id", orderId)
      .in("action", [
        "order.customer_claimed_qris_paid",
        "order.payment_choice_selected",
        "order.tracking_session_expired",
      ])
      .order("id", { ascending: false }),
  ]);

  const auditList = (claimAuditData ?? []) as Array<{
    action: string;
    after: Record<string, unknown> | null;
    created_at: string;
  }>;

  const claimEvent = auditList.find(
    (a) => a.action === "order.customer_claimed_qris_paid"
  );
  const choiceEvent = auditList.find(
    (a) => a.action === "order.payment_choice_selected"
  );
  const expiredEvent = auditList.find(
    (a) => a.action === "order.tracking_session_expired"
  );

  const rawPaymentChoice =
    (params.orderRecord.payment_choice as PaymentMethod | undefined) ??
    (choiceEvent?.after?.payment_choice as PaymentMethod | undefined) ??
    "qris";

  const customerClaimedPaidAt =
    (params.orderRecord.customer_claimed_paid_at as string | null) ??
    claimEvent?.created_at ??
    null;

  const status = params.orderRecord.status as OrderStatus;
  const total = Number(params.orderRecord.total ?? 0);
  const orderNo = String(params.orderRecord.order_no ?? "");

  // Hasilkan SVG QRIS bernominal murni + label MEJA-<no> atau gambar QRIS upload jika metode bayar QRIS dan status masih pending
  let qrisSvg: string | null = null;
  if (rawPaymentChoice === "qris" && status === "pending" && total > 0) {
    const rawStaticPayload =
      (params.outletRecord.qris_raw_payload as string | null)?.trim() ??
      DEFAULT_FALLBACK_STATIC_QRIS;
    if (rawStaticPayload.startsWith("data:image/")) {
      qrisSvg = rawStaticPayload;
    } else {
      try {
        const dynamicPayload = generateDynamicQrisPayload({
          staticQrisPayload: rawStaticPayload,
          amountRupiah: total,
          tableNo: params.tableNo,
          orderNo,
        });
        qrisSvg = generateQrSvgString(dynamicPayload, 2);
      } catch {
        const fallbackPayload = generateDynamicQrisPayload({
          staticQrisPayload: DEFAULT_FALLBACK_STATIC_QRIS,
          amountRupiah: total,
          tableNo: params.tableNo,
          orderNo,
        });
        qrisSvg = generateQrSvgString(fallbackPayload, 2);
      }
    }
  }

  const trackingExpiredColumn = params.orderRecord.tracking_expired_at as
    | string
    | null
    | undefined;
  const sessionExpired = Boolean(trackingExpiredColumn || expiredEvent);

  return {
    orderId,
    orderNo,
    tableNo: params.tableNo,
    tableName: params.tableName,
    outletName: String(params.outletRecord.name ?? "Outlet"),
    qrisMerchantName: String(
      (params.outletRecord.qris_merchant_name as string | null) ??
        params.outletRecord.name ??
        "KAFE NUSANTARA 1621"
    ),
    paymentChoice: rawPaymentChoice,
    status,
    subtotal: Number(params.orderRecord.subtotal ?? 0),
    discount: Number(params.orderRecord.discount ?? 0),
    serviceRate:
      params.orderRecord.service_rate !== null &&
      params.orderRecord.service_rate !== undefined
        ? Number(params.orderRecord.service_rate)
        : null,
    serviceAmount: Number(params.orderRecord.service_amount ?? 0),
    taxRate:
      params.orderRecord.tax_rate !== null &&
      params.orderRecord.tax_rate !== undefined
        ? Number(params.orderRecord.tax_rate)
        : null,
    taxAmount: Number(params.orderRecord.tax_amount ?? 0),
    priceIncludesTax: Boolean(params.orderRecord.price_includes_tax),
    total,
    expiresAt: (params.orderRecord.expires_at as string | null) ?? null,
    createdAt: String(params.orderRecord.created_at),
    paidAt: (params.orderRecord.paid_at as string | null) ?? null,
    readyAt: (params.orderRecord.ready_at as string | null) ?? null,
    servedAt: (params.orderRecord.served_at as string | null) ?? null,
    cancelledAt: (params.orderRecord.cancelled_at as string | null) ?? null,
    cancelReason: (params.orderRecord.cancel_reason as string | null) ?? null,
    customerClaimedPaidAt,
    sessionExpired,
    qrisSvg,
    items: ((itemsData ?? []) as Array<
      Pick<
        OrderItemRow,
        "id" | "product_name" | "unit_price" | "qty" | "note" | "line_total"
      >
    >).map((item) => ({
      id: item.id,
      product_name: item.product_name,
      unit_price: Number(item.unit_price),
      qty: Number(item.qty),
      note: item.note ?? null,
      line_total: Number(item.line_total),
    })),
  };
}

/**
 * Server Action: Pelanggan mengirim pesanan baru dari halaman QR meja (/m/[token]).
 * - Nomor meja ditentukan server dari qr_token.
 * - Harga dan nama produk diambil dari database (snapshot ke order_items).
 * - Total, service, dan pajak dihitung di server lewat src/lib/money.ts.
 * - Rate limit order PENDING per meja dan idempotency_key untuk mencegah duplikat.
 */
export async function createCustomerOrderAction(rawInput: {
  qrToken: string;
  paymentChoice: PaymentMethod;
  idempotencyKey: string;
  items: Array<{ productId: string; qty: number; note?: string | null }>;
}): Promise<CreateCustomerOrderResult> {
  const parsed = createCustomerOrderSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Data pesanan tidak valid.",
    };
  }

  const admin = createSupabaseAdminClient();
  const { qrToken, paymentChoice, idempotencyKey, items } = parsed.data;

  // 1. Validasi Meja dari qr_token
  const { data: tableRow, error: tableErr } = await admin
    .from("tables")
    .select("id, outlet_id, table_no, name, is_active, deleted_at")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (tableErr || !tableRow) {
    return {
      ok: false,
      message:
        "QR meja tidak berlaku atau sudah diganti. Silakan pindai ulang QR di meja Anda.",
    };
  }

  // 2. Ambil konfigurasi Outlet
  const { data: outletRow, error: outletErr } = await admin
    .from("outlets")
    .select("*")
    .eq("id", tableRow.outlet_id)
    .is("deleted_at", null)
    .single();

  if (outletErr || !outletRow) {
    return { ok: false, message: "Konfigurasi outlet tidak ditemukan." };
  }

  const rawOutlet = outletRow as Record<string, unknown>;

  // 3. Cek Idempotency Key (Anti-duplikat saat sinyal pelanggan jelek)
  const { data: existingOrder } = await admin
    .from("orders")
    .select("*")
    .eq("idempotency_key", idempotencyKey)
    .eq("table_id", tableRow.id)
    .maybeSingle();

  if (existingOrder) {
    const view = await buildCustomerOrderTrackingView({
      orderRecord: existingOrder as Record<string, unknown>,
      tableNo: Number(tableRow.table_no),
      tableName: String(tableRow.name),
      outletRecord: rawOutlet,
    });
    return {
      ok: true,
      message: "Pesanan Anda telah diterima.",
      order: view,
    };
  }

  // 4. Kedaluwarsakan order PENDING lama di meja ini yang sudah lewat batas waktu,
  //    lalu cek rate limit jumlah order PENDING aktif di meja ini.
  const nowIso = new Date().toISOString();
  await admin
    .from("orders")
    .update({ status: "expired" })
    .eq("table_id", tableRow.id)
    .eq("status", "pending")
    .lt("expires_at", nowIso);

  const { count: activePendingCount } = await admin
    .from("orders")
    .select("id", { count: "exact", head: true })
    .eq("table_id", tableRow.id)
    .eq("status", "pending")
    .is("deleted_at", null);

  if ((activePendingCount ?? 0) >= MAX_PENDING_ORDERS_PER_TABLE) {
    return {
      ok: false,
      message: `Meja ini sudah memiliki ${activePendingCount} pesanan yang menunggu pembayaran. Silakan selesaikan pembayaran terlebih dahulu.`,
    };
  }

  // 5. Ambil produk dari database untuk memvalidasi ketersediaan & menyalin harga asli (snapshot)
  const productIds = Array.from(new Set(items.map((i) => i.productId)));
  const { data: dbProducts, error: prodErr } = await admin
    .from("products")
    .select("id, name, price, is_available, is_active, deleted_at")
    .eq("outlet_id", tableRow.outlet_id)
    .in("id", productIds);

  if (prodErr || !dbProducts) {
    return { ok: false, message: "Gagal memuat daftar harga produk." };
  }

  const productMap = new Map<
    string,
    { id: string; name: string; price: number; is_available: boolean }
  >();
  for (const p of dbProducts) {
    if (p.is_active && p.deleted_at === null) {
      productMap.set(String(p.id), {
        id: String(p.id),
        name: String(p.name),
        price: Number(p.price),
        is_available: Boolean(p.is_available),
      });
    }
  }

  // Gabungkan item jika ada productId yang sama dengan catatan yang sama
  const normalizedItems: Array<{
    productId: string;
    productName: string;
    unitPrice: number;
    qty: number;
    note: string | null;
    lineTotal: number;
  }> = [];

  for (const reqItem of items) {
    const dbProd = productMap.get(reqItem.productId);
    if (!dbProd) {
      return {
        ok: false,
        message: "Salah satu menu yang dipilih sudah tidak aktif.",
      };
    }
    if (!dbProd.is_available) {
      return {
        ok: false,
        message: `Maaf, menu "${dbProd.name}" baru saja habis. Silakan hapus dari keranjang.`,
      };
    }

    normalizedItems.push({
      productId: dbProd.id,
      productName: dbProd.name,
      unitPrice: dbProd.price,
      qty: reqItem.qty,
      note: reqItem.note && reqItem.note.length > 0 ? reqItem.note : null,
      lineTotal: dbProd.price * reqItem.qty,
    });
  }

  // 6. Hitung total, pajak, dan service charge di server menggunakan src/lib/money.ts
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
    items: normalizedItems.map((i) => ({
      unitPrice: i.unitPrice,
      qty: i.qty,
    })),
    config: taxConfig,
  });

  // 7. Siapkan nomor order & waktu kedaluwarsa (default 15 menit)
  const orderNo = await generateNextOrderNo(String(tableRow.outlet_id));
  const expiryMinutes = Number(rawOutlet.order_expiry_minutes ?? 15);
  const expiresAt = new Date(
    Date.now() + expiryMinutes * 60 * 1000
  ).toISOString();

  const { ip, device } = await getCustomerRequestMeta();
  await admin.rpc("set_audit_context", {
    p_user_id: null,
    p_role: "customer_qr",
    p_device: `${device} | table=${tableRow.name} | token=${qrToken.slice(0, 12)}`,
    p_ip: ip,
    p_reason: `Pesanan mandiri pelanggan dari ${tableRow.name} (${paymentChoice.toUpperCase()})`,
  });

  // 8. Simpan ke tabel orders
  let insertedOrder: Record<string, unknown> | null = null;

  const baseOrderPayload = {
    outlet_id: tableRow.outlet_id,
    order_no: orderNo,
    source: "customer_qr" as const,
    order_type: "dine_in" as const,
    table_id: tableRow.id,
    status: "pending" as const,
    subtotal: totals.subtotal,
    discount: 0,
    discount_reason: null,
    service_rate: totals.serviceRate,
    service_amount: totals.serviceAmount,
    tax_rate: totals.taxRate,
    tax_amount: totals.taxAmount,
    price_includes_tax: totals.priceIncludesTax,
    total: totals.total,
    idempotency_key: idempotencyKey,
    expires_at: expiresAt,
  };

  const { data: tryWithPaymentChoice, error: errWithChoice } = await admin
    .from("orders")
    .insert({
      ...baseOrderPayload,
      payment_choice: paymentChoice,
    })
    .select("*")
    .single();

  if (!errWithChoice && tryWithPaymentChoice) {
    insertedOrder = tryWithPaymentChoice as Record<string, unknown>;
  } else {
    const { data: fallbackOrder, error: fallbackErr } = await admin
      .from("orders")
      .insert(baseOrderPayload)
      .select("*")
      .single();

    if (fallbackErr || !fallbackOrder) {
      return {
        ok: false,
        message: `Gagal membuat pesanan: ${fallbackErr?.message ?? errWithChoice?.message ?? "Unknown error"}`,
      };
    }
    insertedOrder = fallbackOrder as Record<string, unknown>;
  }

  const orderId = String(insertedOrder.id);

  // Catat pilihan metode bayar & nomor meja di audit_logs
  await admin.from("audit_logs").insert({
    outlet_id: String(tableRow.outlet_id),
    user_id: null,
    role: "customer_qr",
    device,
    ip,
    action: "order.payment_choice_selected",
    entity: "orders",
    entity_id: orderId,
    before: null,
    after: {
      order_no: orderNo,
      table_no: Number(tableRow.table_no),
      table_name: String(tableRow.name),
      payment_choice: paymentChoice,
      total: totals.total,
    },
    reason: `Pelanggan memilih metode pembayaran ${paymentChoice.toUpperCase()} di ${tableRow.name}`,
    prev_hash: "",
    hash: "",
  });

  // 9. Simpan snapshot item ke order_items
  const orderItemsPayload = normalizedItems.map((item) => ({
    order_id: orderId,
    product_id: item.productId,
    product_name: item.productName,
    unit_price: item.unitPrice,
    qty: item.qty,
    note: item.note,
    line_total: item.lineTotal,
  }));

  const { error: itemsErr } = await admin
    .from("order_items")
    .insert(orderItemsPayload);

  if (itemsErr) {
    return {
      ok: false,
      message: `Gagal menyimpan daftar menu pesanan: ${itemsErr.message}`,
    };
  }

  const view = await buildCustomerOrderTrackingView({
    orderRecord: insertedOrder,
    tableNo: Number(tableRow.table_no),
    tableName: String(tableRow.name),
    outletRecord: rawOutlet,
  });

  return {
    ok: true,
    message: "Pesanan berhasil dikirim!",
    order: view,
  };
}

/**
 * Server Action: Pelanggan menekan tombol "Saya Sudah Bayar" setelah membayar QRIS di meja.
 * Mencatat sinyal konfirmasi berisi Nomor Meja + Nominal Tagihan agar langsung muncul
 * di Layar Kasir untuk diverifikasi kasir ("Pembayaran Sesuai").
 */
export async function confirmCustomerQrisPaidAction(rawInput: {
  qrToken: string;
  orderId: string;
}): Promise<CreateCustomerOrderResult> {
  const schema = z.object({
    qrToken: qrTokenSchema,
    orderId: z.string().uuid("ID pesanan tidak valid."),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Permintaan konfirmasi tidak valid." };
  }

  const admin = createSupabaseAdminClient();
  const { qrToken, orderId } = parsed.data;

  const { data: tableRow } = await admin
    .from("tables")
    .select("id, outlet_id, table_no, name")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tableRow) {
    return { ok: false, message: "Token QR meja tidak valid." };
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("table_id", tableRow.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!orderRow) {
    return { ok: false, message: "Pesanan tidak ditemukan untuk meja ini." };
  }

  const rawOrder = orderRow as Record<string, unknown>;
  if (rawOrder.status !== "pending") {
    return {
      ok: false,
      message: `Status pesanan saat ini sudah ${String(rawOrder.status).toUpperCase()}.`,
    };
  }

  const claimedAtIso = new Date().toISOString();
  const { ip, device } = await getCustomerRequestMeta();

  // Coba update kolom customer_claimed_paid_at jika migrasi 0004 sudah dijalankan
  const { data: updatedOrder } = await admin
    .from("orders")
    .update({ customer_claimed_paid_at: claimedAtIso })
    .eq("id", orderId)
    .select("*")
    .maybeSingle();

  // Selalu catat event order.customer_claimed_qris_paid ke audit_logs dengan Nomor Meja + Nominal
  await admin.from("audit_logs").insert({
    outlet_id: String(tableRow.outlet_id),
    user_id: null,
    role: "customer_qr",
    device,
    ip,
    action: "order.customer_claimed_qris_paid",
    entity: "orders",
    entity_id: orderId,
    before: { customer_claimed_paid_at: null },
    after: {
      customer_claimed_paid_at: claimedAtIso,
      order_no: String(rawOrder.order_no),
      table_no: Number(tableRow.table_no),
      table_name: String(tableRow.name),
      total: Number(rawOrder.total),
    },
    reason: `Pelanggan di ${tableRow.name} menekan 'Saya Sudah Bayar' untuk QRIS sebesar Rp ${Number(rawOrder.total).toLocaleString("id-ID")}`,
    prev_hash: "",
    hash: "",
  });

  const { data: outletRow } = await admin
    .from("outlets")
    .select("*")
    .eq("id", tableRow.outlet_id)
    .single();

  const view = await buildCustomerOrderTrackingView({
    orderRecord: (updatedOrder ?? rawOrder) as Record<string, unknown>,
    tableNo: Number(tableRow.table_no),
    tableName: String(tableRow.name),
    outletRecord: (outletRow ?? {}) as Record<string, unknown>,
  });

  return {
    ok: true,
    message:
      "Konfirmasi pembayaran dikirim ke Kasir. Mohon tunggu Kasir memverifikasi pembayaran Anda.",
    order: view,
  };
}

/**
 * Server Action: Memantau status terkini pesanan milik meja tersebut.
 * - Otomatis mengubah PENDING -> EXPIRED jika melewati expires_at.
 * - Jika acknowledgeServed = true pada order berstatus SERVED, mengunci sesi tracking
 *   sehingga halaman order lama tersebut resmi berakhir (expired) dan tidak dapat diakses lagi.
 */
export async function getCustomerOrderStatusAction(rawInput: {
  qrToken: string;
  orderId: string;
  acknowledgeServed?: boolean;
}): Promise<CreateCustomerOrderResult> {
  const schema = z.object({
    qrToken: qrTokenSchema,
    orderId: z.string().uuid(),
    acknowledgeServed: z.boolean().optional(),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Parameter pemantauan tidak valid." };
  }

  const admin = createSupabaseAdminClient();
  const { qrToken, orderId, acknowledgeServed } = parsed.data;

  const { data: tableRow } = await admin
    .from("tables")
    .select("id, outlet_id, table_no, name")
    .eq("qr_token", qrToken)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!tableRow) {
    return { ok: false, message: "Token QR meja tidak valid." };
  }

  const { data: orderRow } = await admin
    .from("orders")
    .select("*")
    .eq("id", orderId)
    .eq("table_id", tableRow.id)
    .is("deleted_at", null)
    .maybeSingle();

  if (!orderRow) {
    return { ok: false, message: "Pesanan tidak ditemukan." };
  }

  let currentOrder = orderRow as Record<string, unknown>;

  // Cek kedaluwarsa otomatis 15 menit di sisi server
  if (
    currentOrder.status === "pending" &&
    currentOrder.expires_at &&
    new Date(String(currentOrder.expires_at)).getTime() <= Date.now()
  ) {
    const { data: expiredRow } = await admin
      .from("orders")
      .update({ status: "expired" })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("*")
      .maybeSingle();

    if (expiredRow) {
      currentOrder = expiredRow as Record<string, unknown>;
    }
  }

  // Jika order sudah SERVED dan pelanggan/layar mengonfirmasi akhir sesi tracking
  if (acknowledgeServed && currentOrder.status === "served") {
    const { ip, device } = await getCustomerRequestMeta();
    await admin
      .from("orders")
      .update({ tracking_expired_at: new Date().toISOString() })
      .eq("id", orderId);

    await admin.from("audit_logs").insert({
      outlet_id: String(tableRow.outlet_id),
      user_id: null,
      role: "customer_qr",
      device,
      ip,
      action: "order.tracking_session_expired",
      entity: "orders",
      entity_id: orderId,
      before: null,
      after: {
        order_no: String(currentOrder.order_no),
        status: "served",
        tracking_expired: true,
      },
      reason: "Sesi pemantauan order pelanggan berakhir otomatis setelah SERVED",
      prev_hash: "",
      hash: "",
    });
  }

  const { data: outletRow } = await admin
    .from("outlets")
    .select("*")
    .eq("id", tableRow.outlet_id)
    .single();

  const view = await buildCustomerOrderTrackingView({
    orderRecord: currentOrder,
    tableNo: Number(tableRow.table_no),
    tableName: String(tableRow.name),
    outletRecord: (outletRow ?? {}) as Record<string, unknown>,
  });

  return {
    ok: true,
    message: "Status pesanan diperbarui.",
    order: view,
  };
}
