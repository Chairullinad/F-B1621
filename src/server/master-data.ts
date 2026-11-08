"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { formatRupiah, validateTaxAndServiceConfig } from "@/lib/money";
import { parseEmvTags } from "@/lib/qris";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  CategoryRow,
  InstantNotificationEvents,
  NotificationSettingsRow,
  OutletRow,
  ProductRow,
  TableRow,
} from "@/lib/types/database";
import { requireStaffRole, type ActionResult } from "@/server/auth";
import { dispatchSensitiveEventAlert } from "@/server/owner-notifications";

// ============================================================================
// ZOD SCHEMAS (Validasi Ketat di Server sesuai AGENTS.md)
// ============================================================================

const categoryCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Nama kategori wajib diisi.")
    .max(80, "Nama kategori maksimal 80 karakter."),
  sortOrder: z.number().int("Urutan tampil harus bilangan bulat.").min(0).max(9999),
});

const categoryUpdateSchema = categoryCreateSchema.extend({
  id: z.string().uuid("ID kategori tidak valid."),
  isActive: z.boolean(),
});

const productCreateSchema = z.object({
  categoryId: z.string().uuid("Kategori wajib dipilih."),
  name: z
    .string()
    .trim()
    .min(1, "Nama produk wajib diisi.")
    .max(120, "Nama produk maksimal 120 karakter."),
  price: z
    .number()
    .int("Harga wajib berupa bilangan bulat Rupiah.")
    .min(0, "Harga tidak boleh negatif.")
    .max(100_000_000, "Harga melebihi batas wajar."),
  imageUrl: z
    .string()
    .trim()
    .url("URL foto produk tidak valid.")
    .nullable()
    .or(z.literal("")),
  isAvailable: z.boolean(),
  isActive: z.boolean(),
});

const productUpdateSchema = productCreateSchema.extend({
  id: z.string().uuid("ID produk tidak valid."),
});

const outletProfileSchema = z.object({
  name: z.string().trim().min(1, "Nama outlet wajib diisi.").max(120),
  address: z.string().trim().max(300).nullable(),
  receiptFooter: z.string().trim().max(300).nullable(),
  orderExpiryMinutes: z
    .number()
    .int()
    .min(1, "Minimal 1 menit.")
    .max(120, "Maksimal 120 menit."),
  maxCashierDiscountPercent: z
    .number()
    .min(0)
    .max(100)
    .nullable(),
  maxCashierDiscountAmount: z
    .number()
    .int("Batas diskon nominal harus bilangan bulat Rupiah.")
    .min(0)
    .nullable(),
});

const taxAndServiceSchema = z.object({
  taxEnabled: z.boolean(),
  taxPercent: z.number().gt(0).lte(100).nullable(),
  serviceEnabled: z.boolean(),
  servicePercent: z.number().gt(0).lte(100).nullable(),
  priceIncludesTax: z.boolean(),
});

const qrisSettingsSchema = z.object({
  qrisEnabled: z.boolean(),
  qrisMerchantName: z.string().trim().max(100).nullable(),
  qrisRawPayload: z.string().trim().nullable(),
});

const notificationSettingsSchema = z.object({
  ownerEmail: z
    .string()
    .trim()
    .email("Format email Owner tidak valid.")
    .nullable()
    .or(z.literal("")),
  monthlyReportEnabled: z.boolean(),
  instantEvents: z.object({
    refund: z.boolean(),
    paid_cancellation: z.boolean(),
    discount: z.boolean(),
    price_or_setting_change: z.boolean(),
  }),
});

// ============================================================================
// HELPER AUDIT CONTEXT
// ============================================================================
async function applyOwnerAuditContext(reason: string) {
  const owner = await requireStaffRole(["owner"]);
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "unknown";

  const admin = createSupabaseAdminClient();
  await admin.rpc("set_audit_context", {
    p_user_id: owner.userId,
    p_role: owner.role,
    p_device: device,
    p_ip: ip,
    p_reason: reason,
  });

  return { owner, admin };
}

// ============================================================================
// 1. MASTER KATEGORI
// ============================================================================
export async function listCategoriesForOwner(): Promise<CategoryRow[]> {
  const owner = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("categories")
    .select("*")
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as CategoryRow[];
}

export async function createCategoryAction(rawInput: {
  name: string;
  sortOrder: number;
}): Promise<ActionResult & { category?: CategoryRow }> {
  const parsed = categoryCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input kategori tidak valid.",
    };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    `Tambah kategori: ${parsed.data.name}`
  );

  const { data: created, error } = await admin
    .from("categories")
    .insert({
      outlet_id: owner.outletId,
      name: parsed.data.name,
      sort_order: parsed.data.sortOrder,
      is_active: true,
    })
    .select("*")
    .single();

  if (error || !created) {
    return { ok: false, message: `Gagal menambah kategori: ${error?.message}` };
  }

  revalidatePath("/dashboard/kategori");
  revalidatePath("/dashboard/produk");
  revalidatePath("/dashboard/stok-menu");
  return {
    ok: true,
    message: `Kategori "${parsed.data.name}" berhasil ditambahkan.`,
    category: created as CategoryRow,
  };
}

export async function updateCategoryAction(rawInput: {
  id: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
}): Promise<ActionResult> {
  const parsed = categoryUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Input kategori tidak valid.",
    };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    `Perbarui kategori: ${parsed.data.name}`
  );

  const { error } = await admin
    .from("categories")
    .update({
      name: parsed.data.name,
      sort_order: parsed.data.sortOrder,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      message: `Gagal memperbarui kategori: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/kategori");
  revalidatePath("/dashboard/produk");
  return { ok: true, message: "Kategori berhasil diperbarui." };
}

export async function deleteCategoryAction(rawInput: {
  id: string;
}): Promise<ActionResult> {
  const idSchema = z.string().uuid("ID kategori tidak valid.");
  const parsedId = idSchema.safeParse(rawInput.id);
  if (!parsedId.success) {
    return { ok: false, message: "ID kategori tidak valid." };
  }

  const { owner, admin } = await applyOwnerAuditContext("Soft delete kategori");

  const { count: activeProductsCount } = await admin
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("outlet_id", owner.outletId)
    .eq("category_id", parsedId.data)
    .is("deleted_at", null);

  if ((activeProductsCount ?? 0) > 0) {
    return {
      ok: false,
      message: `Kategori ini masih memiliki ${activeProductsCount} produk aktif. Pindahkan atau hapus produk terlebih dahulu.`,
    };
  }

  const { error } = await admin
    .from("categories")
    .update({
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", parsedId.data)
    .eq("outlet_id", owner.outletId);

  if (error) {
    return { ok: false, message: `Gagal menghapus kategori: ${error.message}` };
  }

  revalidatePath("/dashboard/kategori");
  return { ok: true, message: "Kategori berhasil dihapus." };
}

// ============================================================================
// 2. MASTER PRODUK
// ============================================================================
export async function listProductsForOwner(): Promise<ProductRow[]> {
  const owner = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("products")
    .select("*")
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as ProductRow[];
}

export async function createProductAction(rawInput: {
  categoryId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
}): Promise<ActionResult & { product?: ProductRow }> {
  const parsed = productCreateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data produk tidak valid.",
    };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    `Tambah produk baru: ${parsed.data.name}`
  );

  const { data: created, error } = await admin
    .from("products")
    .insert({
      outlet_id: owner.outletId,
      category_id: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price,
      image_url:
        parsed.data.imageUrl && parsed.data.imageUrl.length > 0
          ? parsed.data.imageUrl
          : null,
      is_available: parsed.data.isAvailable,
      is_active: parsed.data.isActive,
    })
    .select("*")
    .single();

  if (error || !created) {
    return { ok: false, message: `Gagal menambah produk: ${error?.message}` };
  }

  revalidatePath("/dashboard/produk");
  revalidatePath("/dashboard/stok-menu");
  revalidatePath("/order-manual");
  return {
    ok: true,
    message: `Produk "${parsed.data.name}" berhasil ditambahkan.`,
    product: created as ProductRow,
  };
}

export async function updateProductAction(rawInput: {
  id: string;
  categoryId: string;
  name: string;
  price: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isActive: boolean;
}): Promise<ActionResult> {
  const parsed = productUpdateSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data produk tidak valid.",
    };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    `Perbarui produk: ${parsed.data.name}`
  );

  const { error } = await admin
    .from("products")
    .update({
      category_id: parsed.data.categoryId,
      name: parsed.data.name,
      price: parsed.data.price,
      image_url:
        parsed.data.imageUrl && parsed.data.imageUrl.length > 0
          ? parsed.data.imageUrl
          : null,
      is_available: parsed.data.isAvailable,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      message: `Gagal memperbarui produk: ${error.message}`,
    };
  }

  await dispatchSensitiveEventAlert({
    outletId: owner.outletId,
    eventType: "price_or_setting_change",
    subject: `Perubahan Produk / Harga: ${parsed.data.name} (${formatRupiah(parsed.data.price)})`,
    summaryText: `Produk "${parsed.data.name}" diperbarui oleh ${owner.fullName} dengan harga ${formatRupiah(parsed.data.price)}.`,
    actorName: `${owner.fullName} (${owner.role})`,
    entityId: parsed.data.id,
    details: {
      product_id: parsed.data.id,
      name: parsed.data.name,
      price: parsed.data.price,
    },
  });

  revalidatePath("/dashboard/produk");
  return { ok: true, message: "Data produk berhasil diperbarui." };
}

export async function toggleProductAvailabilityAction(rawInput: {
  id: string;
  isAvailable: boolean;
}): Promise<ActionResult> {
  const schema = z.object({
    id: z.string().uuid(),
    isAvailable: z.boolean(),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Data produk tidak valid." };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    parsed.data.isAvailable
      ? "Toggle produk menjadi Tersedia"
      : "Toggle produk menjadi Habis"
  );

  const { error } = await admin
    .from("products")
    .update({ is_available: parsed.data.isAvailable })
    .eq("id", parsed.data.id)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      message: `Gagal mengubah status ketersediaan: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/produk");
  return {
    ok: true,
    message: parsed.data.isAvailable
      ? "Produk ditandai Tersedia."
      : "Produk ditandai Habis (tidak dapat dipesan pelanggan).",
  };
}

export async function deleteProductAction(rawInput: {
  id: string;
}): Promise<ActionResult> {
  const parsedId = z.string().uuid().safeParse(rawInput.id);
  if (!parsedId.success) {
    return { ok: false, message: "ID produk tidak valid." };
  }

  const { owner, admin } = await applyOwnerAuditContext("Soft delete produk");

  const { error } = await admin
    .from("products")
    .update({
      is_available: false,
      is_active: false,
      deleted_at: new Date().toISOString(),
    })
    .eq("id", parsedId.data)
    .eq("outlet_id", owner.outletId);

  if (error) {
    return { ok: false, message: `Gagal menghapus produk: ${error.message}` };
  }

  revalidatePath("/dashboard/produk");
  return { ok: true, message: "Produk berhasil dihapus." };
}

// ============================================================================
// 3. MASTER MEJA & QR (100 Meja)
// ============================================================================
export async function listTablesForOwner(): Promise<TableRow[]> {
  const owner = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const { data, error } = await admin
    .from("tables")
    .select("*")
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null)
    .order("table_no", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as TableRow[];
}

export async function toggleTableActiveAction(rawInput: {
  id: string;
  isActive: boolean;
}): Promise<ActionResult> {
  const schema = z.object({
    id: z.string().uuid(),
    isActive: z.boolean(),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Data meja tidak valid." };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    parsed.data.isActive ? "Aktifkan meja" : "Nonaktifkan meja"
  );

  const { error } = await admin
    .from("tables")
    .update({ is_active: parsed.data.isActive })
    .eq("id", parsed.data.id)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: `Gagal mengubah status meja: ${error.message}` };
  }

  revalidatePath("/dashboard/meja");
  revalidatePath("/dashboard/meja/cetak");
  return {
    ok: true,
    message: parsed.data.isActive
      ? "Meja berhasil diaktifkan."
      : "Meja berhasil dinonaktifkan.",
  };
}

export async function regenerateTableQrTokenAction(rawInput: {
  id: string;
}): Promise<ActionResult> {
  const parsedId = z.string().uuid().safeParse(rawInput.id);
  if (!parsedId.success) {
    return { ok: false, message: "ID meja tidak valid." };
  }

  const newQrToken = crypto.randomBytes(24).toString("hex");
  const { owner, admin } = await applyOwnerAuditContext(
    "Regenerasi token QR meja (QR lama otomatis tidak berlaku)"
  );

  const { error } = await admin
    .from("tables")
    .update({ qr_token: newQrToken })
    .eq("id", parsedId.data)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null);

  if (error) {
    return {
      ok: false,
      message: `Gagal mengganti token QR meja: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/meja");
  revalidatePath("/dashboard/meja/cetak");
  return {
    ok: true,
    message:
      "Token QR meja berhasil diperbarui. QR lama tidak berlaku lagi; silakan cetak ulang QR meja ini.",
  };
}

// ============================================================================
// 4. PENGATURAN OUTLET, QRIS, PAJAK & SERVICE CHARGE, SERTA NOTIFIKASI EMAIL
// ============================================================================
export interface OutletAndNotificationSettings {
  outlet: OutletRow;
  notification: NotificationSettingsRow;
}

export async function getOutletAndNotificationSettings(): Promise<OutletAndNotificationSettings> {
  const owner = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();

  const [{ data: outletData, error: outletErr }, { data: notifData }] =
    await Promise.all([
      admin
        .from("outlets")
        .select("*")
        .eq("id", owner.outletId)
        .single(),
      admin
        .from("notification_settings")
        .select("*")
        .eq("outlet_id", owner.outletId)
        .maybeSingle(),
    ]);

  if (outletErr || !outletData) {
    throw new Error("Data outlet tidak ditemukan.");
  }

  const rawOutlet = outletData as Record<string, unknown>;
  const outlet: OutletRow = {
    id: String(rawOutlet.id),
    name: String(rawOutlet.name ?? ""),
    address: (rawOutlet.address as string | null) ?? null,
    receipt_footer: (rawOutlet.receipt_footer as string | null) ?? null,
    order_expiry_minutes: Number(rawOutlet.order_expiry_minutes ?? 15),
    tax_enabled: Boolean(rawOutlet.tax_enabled),
    tax_percent:
      rawOutlet.tax_percent !== null && rawOutlet.tax_percent !== undefined
        ? Number(rawOutlet.tax_percent)
        : null,
    service_enabled: Boolean(rawOutlet.service_enabled),
    service_percent:
      rawOutlet.service_percent !== null &&
      rawOutlet.service_percent !== undefined
        ? Number(rawOutlet.service_percent)
        : null,
    price_includes_tax: Boolean(rawOutlet.price_includes_tax),
    qris_enabled: Boolean(rawOutlet.qris_enabled ?? false),
    qris_raw_payload: (rawOutlet.qris_raw_payload as string | null) ?? null,
    qris_merchant_name: (rawOutlet.qris_merchant_name as string | null) ?? null,
    max_cashier_discount_percent:
      rawOutlet.max_cashier_discount_percent !== null &&
      rawOutlet.max_cashier_discount_percent !== undefined
        ? Number(rawOutlet.max_cashier_discount_percent)
        : null,
    max_cashier_discount_amount:
      rawOutlet.max_cashier_discount_amount !== null &&
      rawOutlet.max_cashier_discount_amount !== undefined
        ? Number(rawOutlet.max_cashier_discount_amount)
        : null,
    created_at: String(rawOutlet.created_at),
    updated_at: String(rawOutlet.updated_at),
  };

  const defaultEvents: InstantNotificationEvents = {
    refund: false,
    paid_cancellation: false,
    discount: false,
    price_or_setting_change: false,
  };

  const notification: NotificationSettingsRow = notifData
    ? {
        id: String(notifData.id),
        outlet_id: String(notifData.outlet_id),
        owner_email: (notifData.owner_email as string | null) ?? null,
        monthly_report_enabled: Boolean(notifData.monthly_report_enabled),
        instant_events: {
          ...defaultEvents,
          ...((notifData.instant_events as Partial<InstantNotificationEvents>) ??
            {}),
        },
        updated_at: String(notifData.updated_at),
      }
    : {
        id: "",
        outlet_id: owner.outletId,
        owner_email: null,
        monthly_report_enabled: false,
        instant_events: defaultEvents,
        updated_at: new Date().toISOString(),
      };

  return { outlet, notification };
}

export async function updateOutletProfileSettingsAction(rawInput: {
  name: string;
  address: string | null;
  receiptFooter: string | null;
  orderExpiryMinutes: number;
  maxCashierDiscountPercent: number | null;
  maxCashierDiscountAmount: number | null;
}): Promise<ActionResult> {
  const parsed = outletProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Pengaturan outlet tidak valid.",
    };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    "Pembaruan pengaturan profil outlet & batas diskon kasir"
  );

  const { error } = await admin
    .from("outlets")
    .update({
      name: parsed.data.name,
      address: parsed.data.address,
      receipt_footer: parsed.data.receiptFooter,
      order_expiry_minutes: parsed.data.orderExpiryMinutes,
      max_cashier_discount_percent: parsed.data.maxCashierDiscountPercent,
      max_cashier_discount_amount: parsed.data.maxCashierDiscountAmount,
    })
    .eq("id", owner.outletId);

  if (error) {
    return {
      ok: false,
      message: `Gagal menyimpan pengaturan outlet: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/order-manual");
  revalidatePath("/kasir");
  return { ok: true, message: "Pengaturan outlet berhasil disimpan." };
}

export async function updateTaxAndServiceSettingsAction(rawInput: {
  taxEnabled: boolean;
  taxPercent: number | null;
  serviceEnabled: boolean;
  servicePercent: number | null;
  priceIncludesTax: boolean;
}): Promise<ActionResult> {
  const parsed = taxAndServiceSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Pengaturan pajak/service charge tidak valid.",
    };
  }

  try {
    validateTaxAndServiceConfig(parsed.data);
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : "Saklar tidak dapat dinyalakan sebelum persentase diisi.",
    };
  }

  const { owner, admin } = await applyOwnerAuditContext(
    "Pembaruan pengaturan pajak & service charge (berlaku untuk order baru)"
  );

  const { error } = await admin
    .from("outlets")
    .update({
      tax_enabled: parsed.data.taxEnabled,
      tax_percent: parsed.data.taxPercent,
      service_enabled: parsed.data.serviceEnabled,
      service_percent: parsed.data.servicePercent,
      price_includes_tax: parsed.data.priceIncludesTax,
    })
    .eq("id", owner.outletId);

  if (error) {
    return {
      ok: false,
      message: `Gagal menyimpan pengaturan pajak: ${error.message}`,
    };
  }

  await dispatchSensitiveEventAlert({
    outletId: owner.outletId,
    eventType: "price_or_setting_change",
    subject: "Perubahan Pengaturan Pajak & Service Charge Outlet",
    summaryText: `Pengaturan Pajak (${parsed.data.taxEnabled ? `${parsed.data.taxPercent}%` : "Mati"}) dan Service Charge (${parsed.data.serviceEnabled ? `${parsed.data.servicePercent}%` : "Mati"}) telah diperbarui oleh ${owner.fullName}.`,
    actorName: `${owner.fullName} (${owner.role})`,
    entityId: owner.outletId,
    details: parsed.data,
  });

  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/order-manual");
  revalidatePath("/kasir");
  return {
    ok: true,
    message:
      "Pengaturan pajak dan service charge berhasil disimpan (berlaku untuk order baru).",
  };
}

export async function updateQrisSettingsAction(rawInput: {
  qrisEnabled: boolean;
  qrisMerchantName: string | null;
  qrisRawPayload: string | null;
}): Promise<ActionResult> {
  const parsed = qrisSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ?? "Pengaturan QRIS tidak valid.",
    };
  }

  const payload =
    parsed.data.qrisRawPayload && parsed.data.qrisRawPayload.length > 0
      ? parsed.data.qrisRawPayload
      : null;

  if (parsed.data.qrisEnabled && !payload) {
    return {
      ok: false,
      message:
        "Saklar QRIS tidak dapat dinyalakan sebelum gambar QRIS di-upload atau kode QRIS diisi.",
    };
  }

  if (payload && !payload.startsWith("data:image/")) {
    try {
      parseEmvTags(payload);
    } catch (err) {
      return {
        ok: false,
        message:
          err instanceof Error
            ? err.message
            : "Kode string QRIS tidak sesuai standar EMVCo.",
      };
    }
  }

  const { owner, admin } = await applyOwnerAuditContext(
    "Pembaruan pengaturan QRIS toko"
  );

  const { error } = await admin
    .from("outlets")
    .update({
      qris_enabled: parsed.data.qrisEnabled,
      qris_merchant_name:
        parsed.data.qrisMerchantName && parsed.data.qrisMerchantName.length > 0
          ? parsed.data.qrisMerchantName
          : null,
      qris_raw_payload: payload,
    })
    .eq("id", owner.outletId);

  if (error) {
    return {
      ok: false,
      message: `Gagal menyimpan pengaturan QRIS (pastikan migrasi 0004 sudah dijalankan): ${error.message}`,
    };
  }

  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/order-manual");
  revalidatePath("/kasir");
  return { ok: true, message: "Pengaturan QRIS toko berhasil disimpan." };
}

export async function updateNotificationSettingsAction(rawInput: {
  ownerEmail: string | null;
  monthlyReportEnabled: boolean;
  instantEvents: InstantNotificationEvents;
}): Promise<ActionResult> {
  const parsed = notificationSettingsSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Pengaturan notifikasi email tidak valid.",
    };
  }

  const normalizedEmail =
    parsed.data.ownerEmail && parsed.data.ownerEmail.length > 0
      ? parsed.data.ownerEmail
      : null;

  const { owner, admin } = await applyOwnerAuditContext(
    "Pembaruan pengaturan notifikasi email Owner"
  );

  const { error } = await admin.from("notification_settings").upsert(
    {
      outlet_id: owner.outletId,
      owner_email: normalizedEmail,
      monthly_report_enabled: parsed.data.monthlyReportEnabled,
      instant_events: parsed.data.instantEvents,
    },
    { onConflict: "outlet_id" }
  );

  if (error) {
    return {
      ok: false,
      message: `Gagal menyimpan pengaturan notifikasi: ${error.message}`,
    };
  }

  revalidatePath("/dashboard/pengaturan");
  return {
    ok: true,
    message: "Pengaturan notifikasi email Owner berhasil disimpan.",
  };
}

