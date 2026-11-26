"use server";

import crypto from "node:crypto";
import { revalidatePath, revalidateTag, unstable_cache } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  DEFAULT_OUTLET_TABLE_COUNT,
  isSafeActionLinkUrl,
  mapOutletRowToSidebarView,
  mapOutletRowToView,
  planOutletTableCountSync,
  type OutletView,
  type SidebarOutletView,
} from "@/lib/outlets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole, type ActionResult } from "@/server/auth";
import { revalidateOutletCatalogCache } from "@/server/outlet-catalog-cache";

const createOutletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama outlet minimal 2 karakter.")
    .max(100, "Nama outlet maksimal 100 karakter."),
  address: z.string().trim().max(250).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  description: z.string().trim().max(250).optional().default("Kafe & Resto Modern"),
  receiptFooter: z
    .string()
    .trim()
    .max(300)
    .optional()
    .default("Terima kasih atas kunjungan Anda!"),
  wifiName: z
    .string()
    .trim()
    .max(80, "Nama WiFi maksimal 80 karakter.")
    .optional()
    .default(""),
  wifiPassword: z
    .string()
    .trim()
    .max(80, "Password WiFi maksimal 80 karakter.")
    .optional()
    .default(""),
  logoUrl: z
    .string()
    .trim()
    .max(450_000, "Ukuran gambar logo terlalu besar. Pilih gambar yang lebih kecil.")
    .default("/logo-1621group-stacked.png"),
  themeColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Format warna harus hex #RRGGBB.")
    .default("#0284C7"),
  tableCount: z.coerce
    .number()
    .int("Jumlah meja harus berupa bilangan bulat.")
    .min(1, "Minimal 1 meja per outlet.")
    .max(1000, "Maksimal 1000 meja per outlet.")
    .default(DEFAULT_OUTLET_TABLE_COUNT),
});

const updateOutletSchema = z.object({
  id: z.string().uuid("ID outlet tidak valid."),
  name: z
    .string()
    .trim()
    .min(2, "Nama outlet minimal 2 karakter.")
    .max(100),
  address: z.string().trim().max(250).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  description: z.string().trim().max(250).optional().default(""),
  receiptFooter: z.string().trim().max(300).optional().default(""),
  wifiName: z
    .string()
    .trim()
    .max(80, "Nama WiFi maksimal 80 karakter.")
    .optional()
    .default(""),
  wifiPassword: z
    .string()
    .trim()
    .max(80, "Password WiFi maksimal 80 karakter.")
    .optional()
    .default(""),
  logoUrl: z
    .string()
    .trim()
    .max(450_000, "Ukuran gambar logo terlalu besar. Pilih gambar yang lebih kecil.")
    .default("/logo-1621group-stacked.png"),
  themeColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Format warna harus hex #RRGGBB.")
    .default("#0284C7"),
  tableCount: z.coerce
    .number()
    .int("Jumlah meja harus berupa bilangan bulat.")
    .min(1, "Minimal 1 meja per outlet.")
    .max(1000, "Maksimal 1000 meja per outlet.")
    .optional(),
});

const bannerImageUrlSchema = z
  .string()
  .trim()
  .min(1, "Gambar banner tidak boleh kosong.")
  .max(
    700_000,
    "Ukuran gambar banner terlalu besar. Silakan pilih gambar lain yang lebih kecil."
  )
  .refine(
    (val) =>
      val.startsWith("/") ||
      val.startsWith("https://") ||
      val.startsWith("http://") ||
      val.startsWith("data:image/"),
    "Format gambar banner tidak valid."
  );

const optionalActionUrlSchema = z
  .string()
  .trim()
  .max(500, "Link maksimal 500 karakter.")
  .refine(
    (val) => val === "" || isSafeActionLinkUrl(val),
    "Link tombol harus diawali https://, http://, mailto:, atau tel:."
  )
  .default("");

const updateOutletLandingPageSchema = z.object({
  outletId: z.string().uuid("ID outlet tidak valid."),
  operatingHours: z
    .string()
    .trim()
    .min(2, "Jam operasional minimal 2 karakter.")
    .max(80, "Jam operasional maksimal 80 karakter.")
    .default("08.00 - 22.00 WIB"),
  landingTagline: z
    .string()
    .trim()
    .max(200, "Tagline maksimal 200 karakter.")
    .default(""),
  landingBanners: z
    .array(
      z.object({
        id: z.string().trim().min(1).max(80),
        imageUrl: bannerImageUrlSchema,
        caption: z.string().trim().max(120).optional().default(""),
      })
    )
    .max(5, "Maksimal 5 banner iklan.")
    .default([]),
  landingNewsTitle: z
    .string()
    .trim()
    .min(2, "Judul bagian berita/promo minimal 2 karakter.")
    .max(60, "Judul bagian berita/promo maksimal 60 karakter.")
    .default("PROMO & BERITA"),
  landingNewsBannerUrl: z
    .string()
    .trim()
    .max(700_000, "Ukuran gambar banner berita terlalu besar.")
    .refine(
      (val) =>
        val === "" ||
        val.startsWith("/") ||
        val.startsWith("https://") ||
        val.startsWith("http://") ||
        val.startsWith("data:image/"),
      "Format gambar banner berita tidak valid."
    )
    .default(""),
  partnershipUrl: optionalActionUrlSchema,
  reservationUrl: optionalActionUrlSchema,
  feedbackUrl: optionalActionUrlSchema,
});

async function getRequestMeta(): Promise<{ ip: string; device: string }> {
  const hdrs = await headers();
  const forwardedFor = hdrs.get("x-forwarded-for");
  const ip =
    (forwardedFor ? forwardedFor.split(",")[0]?.trim() : null) ??
    hdrs.get("x-real-ip") ??
    "127.0.0.1";
  const device = hdrs.get("user-agent") ?? "outlet-manager";
  return { ip, device };
}

const getCachedSidebarOutlets = unstable_cache(
  async (): Promise<SidebarOutletView[]> => {
    const admin = createSupabaseAdminClient();
    const { data: rawOutlets } = await admin
      .from("outlets")
      .select("id, name, description, logo_url, theme_color, receipt_footer")
      .is("deleted_at", null)
      .order("created_at", { ascending: true });

    return (rawOutlets ?? []).map((o) =>
      mapOutletRowToSidebarView(o as Record<string, unknown>)
    );
  },
  ["sidebar_outlets"],
  { revalidate: 60, tags: ["sidebar_outlets"] }
);

export async function listSidebarOutletsAction(): Promise<{
  outlets: SidebarOutletView[];
  activeOutletId: string | null;
}> {
  const staff = await requireStaffRole([
    "owner",
    "cashier",
    "warehouse",
    "kitchen",
    "waiter",
  ]);
  const outlets = await getCachedSidebarOutlets();

  if (staff.role !== "owner") {
    return { outlets, activeOutletId: staff.outletId };
  }

  const validSelectedId =
    staff.selectedOutletId && outlets.some((o) => o.id === staff.selectedOutletId)
      ? staff.selectedOutletId
      : null;

  return { outlets, activeOutletId: validSelectedId };
}

export async function listAllOutletsAction(): Promise<{
  outlets: OutletView[];
  activeOutletId: string | null;
}> {
  const staff = await requireStaffRole(["owner", "cashier", "warehouse", "kitchen", "waiter"]);
  const admin = createSupabaseAdminClient();

  const [{ data: rawOutlets }, { data: rawTables }] = await Promise.all([
    admin
      .from("outlets")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    admin
      .from("tables")
      .select("outlet_id")
      .is("deleted_at", null),
  ]);

  const tableCountMap = new Map<string, number>();
  for (const t of rawTables ?? []) {
    const oid = String(t.outlet_id);
    tableCountMap.set(oid, (tableCountMap.get(oid) ?? 0) + 1);
  }

  const outlets: OutletView[] = (rawOutlets ?? []).map((o) => {
    const view = mapOutletRowToView(o as Record<string, unknown>);
    return {
      ...view,
      tableCount: tableCountMap.get(view.id) ?? 0,
    };
  });

  if (staff.role !== "owner") {
    return { outlets, activeOutletId: staff.outletId };
  }

  const validSelectedId =
    staff.selectedOutletId && outlets.some((o) => o.id === staff.selectedOutletId)
      ? staff.selectedOutletId
      : null;

  return { outlets, activeOutletId: validSelectedId };
}

async function syncOutletTablesCount(params: {
  admin: ReturnType<typeof createSupabaseAdminClient>;
  outletId: string;
  targetCount: number;
}): Promise<{ ok: true; activeCount: number } | { ok: false; message: string }> {
  const { admin, outletId, targetCount } = params;

  const { data: existingRows, error: fetchErr } = await admin
    .from("tables")
    .select("id, table_no, is_active, deleted_at")
    .eq("outlet_id", outletId);

  if (fetchErr) {
    return { ok: false, message: `Gagal membaca daftar meja outlet: ${fetchErr.message}` };
  }

  const existing = (existingRows ?? []).map((row) => ({
    id: String(row.id),
    tableNo: Number(row.table_no),
    isActive: Boolean(row.is_active),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  }));

  const plan = planOutletTableCountSync(existing, targetCount);

  if (plan.toSoftDeleteIds.length > 0) {
    const { data: activeOrders } = await admin
      .from("orders")
      .select("table_id")
      .eq("outlet_id", outletId)
      .in("table_id", plan.toSoftDeleteIds)
      .in("status", ["pending", "paid", "ready"])
      .is("deleted_at", null)
      .limit(1);

    if (activeOrders && activeOrders.length > 0) {
      return {
        ok: false,
        message: `Tidak dapat mengurangi meja hingga ${targetCount} karena meja nomor di atasnya (${plan.toSoftDeleteNos.slice(0, 5).join(", ")}${plan.toSoftDeleteNos.length > 5 ? ", ..." : ""}) masih memiliki pesanan aktif.`,
      };
    }

    const { error: delErr } = await admin
      .from("tables")
      .update({
        deleted_at: new Date().toISOString(),
        is_active: false,
      })
      .in("id", plan.toSoftDeleteIds);

    if (delErr) {
      return { ok: false, message: `Gagal menonaktifkan meja tambahan: ${delErr.message}` };
    }
  }

  if (plan.toRestoreIds.length > 0) {
    const { error: restoreErr } = await admin
      .from("tables")
      .update({
        deleted_at: null,
        is_active: true,
      })
      .in("id", plan.toRestoreIds);

    if (restoreErr) {
      return { ok: false, message: `Gagal memulihkan meja lama: ${restoreErr.message}` };
    }
  }

  if (plan.toInsertNos.length > 0) {
    const newRows = plan.toInsertNos.map((no) => ({
      outlet_id: outletId,
      table_no: no,
      name: `Meja ${no}`,
      qr_token: crypto.randomBytes(24).toString("hex"),
      is_active: true,
    }));

    const { error: insErr } = await admin.from("tables").insert(newRows);
    if (insErr) {
      return { ok: false, message: `Gagal membuat meja baru: ${insErr.message}` };
    }
  }

  return { ok: true, activeCount: targetCount };
}

export async function createOutletAction(
  rawInput: z.input<typeof createOutletSchema>
): Promise<ActionResult & { outletId?: string; outlet?: OutletView }> {
  const staff = await requireStaffRole(["owner"]);
  const parsed = createOutletSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const { ip, device } = await getRequestMeta();
  const admin = createSupabaseAdminClient();

  const cleanLogoUrl = parsed.data.logoUrl || "/logo-1621group-stacked.png";
  const cleanThemeColor = parsed.data.themeColor || "#0284C7";
  const cleanDescription = parsed.data.description || "Kafe & Resto Modern";
  const cleanFooter =
    parsed.data.receiptFooter || `Terima kasih telah berkunjung ke ${parsed.data.name}!`;
  const cleanWifiName = parsed.data.wifiName || null;
  const cleanWifiPassword = parsed.data.wifiPassword || null;

  const baseInsertPayload = {
    name: parsed.data.name,
    address: parsed.data.address || null,
    phone: parsed.data.phone || null,
    description: cleanDescription,
    logo_url: cleanLogoUrl,
    theme_color: cleanThemeColor,
    receipt_footer: cleanFooter,
    order_expiry_minutes: 15,
    tax_enabled: false,
    tax_percent: null,
    service_enabled: false,
    service_percent: null,
    price_includes_tax: false,
  };

  let { data: newOutlet, error: insErr } = await admin
    .from("outlets")
    .insert({
      ...baseInsertPayload,
      wifi_name: cleanWifiName,
      wifi_password: cleanWifiPassword,
    })
    .select("*")
    .single();

  if (
    insErr &&
    (insErr.message.includes("wifi_name") ||
      insErr.message.includes("wifi_password") ||
      insErr.message.includes("schema cache"))
  ) {
    const fallbackInsert = await admin
      .from("outlets")
      .insert(baseInsertPayload)
      .select("*")
      .single();
    newOutlet = fallbackInsert.data;
    insErr = fallbackInsert.error;
  }

  if (insErr || !newOutlet) {
    return { ok: false, message: `Gagal membuat outlet baru: ${insErr?.message}` };
  }

  const newOutletId = String(newOutlet.id);

  // Buat Meja Awal Otomatis sesuai input (default 50 meja) lengkap dengan qr_token unik
  const syncRes = await syncOutletTablesCount({
    admin,
    outletId: newOutletId,
    targetCount: parsed.data.tableCount,
  });
  if (!syncRes.ok) {
    console.error("Gagal inisialisasi meja outlet baru:", syncRes.message);
  }

  // Catat ke Audit Log (aman)
  try {
    await admin.from("audit_logs").insert({
      outlet_id: newOutletId,
      user_id: staff.userId,
      role: staff.role,
      device,
      ip,
      action: "outlet.created",
      entity: "outlets",
      entity_id: newOutletId,
      before: null,
      after: {
        name: parsed.data.name,
        address: parsed.data.address,
        phone: parsed.data.phone,
        description: cleanDescription,
        theme_color: cleanThemeColor,
        has_logo: Boolean(cleanLogoUrl),
        table_count: parsed.data.tableCount,
      },
      reason: `Owner menambahkan outlet baru '${parsed.data.name}' dengan ${parsed.data.tableCount} meja`,
      prev_hash: "",
      hash: "",
    });
  } catch (auditErr) {
    console.error("Gagal mencatat audit log outlet baru:", auditErr);
  }

  revalidateTag("sidebar_outlets");
  revalidateOutletCatalogCache(newOutletId);
  revalidatePath("/dashboard/cabang");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/dashboard/meja");
  revalidatePath("/dashboard/meja/cetak");

  const newOutletView = {
    ...mapOutletRowToView(newOutlet as Record<string, unknown>),
    tableCount: parsed.data.tableCount,
  };

  return {
    ok: true,
    message: `Outlet '${parsed.data.name}' berhasil dibuat dengan ${parsed.data.tableCount} meja & QR Code siap pakai.`,
    outletId: newOutletId,
    outlet: newOutletView,
  };
}

export async function updateOutletCustomizationAction(
  rawInput: z.input<typeof updateOutletSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner"]);
  const parsed = updateOutletSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const { ip, device } = await getRequestMeta();
  const admin = createSupabaseAdminClient();

  const { data: beforeData } = await admin
    .from("outlets")
    .select("*")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const existingView = beforeData
    ? mapOutletRowToView(beforeData as Record<string, unknown>)
    : null;
  const resolvedFooter =
    parsed.data.receiptFooter.trim().length > 0
      ? parsed.data.receiptFooter.trim()
      : existingView?.receiptFooter ?? null;

  if (parsed.data.tableCount !== undefined) {
    const syncRes = await syncOutletTablesCount({
      admin,
      outletId: parsed.data.id,
      targetCount: parsed.data.tableCount,
    });
    if (!syncRes.ok) {
      return { ok: false, message: syncRes.message };
    }
  }

  const cleanWifiName = parsed.data.wifiName.trim() || null;
  const cleanWifiPassword = parsed.data.wifiPassword.trim() || null;
  const baseUpdatePayload = {
    name: parsed.data.name,
    address: parsed.data.address || null,
    phone: parsed.data.phone || null,
    description: parsed.data.description || null,
    logo_url: parsed.data.logoUrl || "/logo-1621group-stacked.png",
    theme_color: parsed.data.themeColor || "#0284C7",
    receipt_footer: resolvedFooter,
    updated_at: new Date().toISOString(),
  };

  let { error: updErr } = await admin
    .from("outlets")
    .update({
      ...baseUpdatePayload,
      wifi_name: cleanWifiName,
      wifi_password: cleanWifiPassword,
    })
    .eq("id", parsed.data.id);

  let wifiMigrationMissing = false;
  if (
    updErr &&
    (updErr.message.includes("wifi_name") ||
      updErr.message.includes("wifi_password") ||
      updErr.message.includes("schema cache"))
  ) {
    wifiMigrationMissing = Boolean(cleanWifiName || cleanWifiPassword);
    const fallbackUpd = await admin
      .from("outlets")
      .update(baseUpdatePayload)
      .eq("id", parsed.data.id);
    updErr = fallbackUpd.error;
  }

  if (updErr) {
    return { ok: false, message: `Gagal memperbarui profil outlet: ${updErr.message}` };
  }

  if (wifiMigrationMissing) {
    return {
      ok: false,
      message:
        "Profil outlet disimpan, tetapi kolom wifi_name / wifi_password belum ada di database. Jalankan migrasi 0012 di Supabase SQL Editor terlebih dahulu.",
    };
  }

  await admin.from("audit_logs").insert({
    outlet_id: parsed.data.id,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "outlet.theme_updated",
    entity: "outlets",
    entity_id: parsed.data.id,
    before: beforeData,
    after: {
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description || null,
      theme_color: parsed.data.themeColor,
      receipt_footer: resolvedFooter,
      wifi_name: cleanWifiName,
      wifi_password: cleanWifiPassword,
      ...(parsed.data.tableCount !== undefined
        ? { table_count: parsed.data.tableCount }
        : {}),
    },
    reason:
      parsed.data.tableCount !== undefined
        ? `Owner memperbarui profil, logo, & jumlah meja (${parsed.data.tableCount}) outlet '${parsed.data.name}'`
        : `Owner memperbarui profil & logo outlet '${parsed.data.name}'`,
    prev_hash: "",
    hash: "",
  });

  revalidateTag("sidebar_outlets");
  revalidateOutletCatalogCache(parsed.data.id);
  revalidatePath("/dashboard/cabang");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/dashboard/meja");
  revalidatePath("/dashboard/meja/cetak");
  revalidatePath("/order-manual");
  revalidatePath("/kasir");

  return {
    ok: true,
    message:
      parsed.data.tableCount !== undefined
        ? `Profil & ${parsed.data.tableCount} meja QR outlet '${parsed.data.name}' berhasil disimpan.`
        : `Profil outlet '${parsed.data.name}' berhasil disimpan.`,
  };
}

export async function updateOutletLandingPageAction(
  rawInput: z.input<typeof updateOutletLandingPageSchema>
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner"]);
  const parsed = updateOutletLandingPageSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data landing page tidak valid.",
    };
  }

  const { ip, device } = await getRequestMeta();
  const admin = createSupabaseAdminClient();

  const { data: beforeData } = await admin
    .from("outlets")
    .select(
      "id, name, operating_hours, landing_tagline, landing_news_title, partnership_url, reservation_url, feedback_url"
    )
    .eq("id", parsed.data.outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!beforeData) {
    return { ok: false, message: "Outlet tidak ditemukan atau sudah dinonaktifkan." };
  }

  const cleanBanners = parsed.data.landingBanners.map((b) => ({
    id: b.id,
    imageUrl: b.imageUrl,
    ...(b.caption ? { caption: b.caption } : {}),
  }));

  const firstBannerUrl = cleanBanners[0]?.imageUrl ?? null;

  const { error: updErr } = await admin
    .from("outlets")
    .update({
      landing_banners: cleanBanners,
      cover_banner_url: firstBannerUrl,
      landing_news_title: parsed.data.landingNewsTitle,
      landing_news_banner_url: parsed.data.landingNewsBannerUrl || null,
      operating_hours: parsed.data.operatingHours,
      landing_tagline: parsed.data.landingTagline || null,
      partnership_url: parsed.data.partnershipUrl || null,
      reservation_url: parsed.data.reservationUrl || null,
      feedback_url: parsed.data.feedbackUrl || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.outletId);

  if (updErr) {
    return {
      ok: false,
      message: `Gagal menyimpan pengaturan landing page: ${updErr.message}`,
    };
  }

  await admin.from("audit_logs").insert({
    outlet_id: parsed.data.outletId,
    user_id: staff.userId,
    role: staff.role,
    device,
    ip,
    action: "outlet.landing_updated",
    entity: "outlets",
    entity_id: parsed.data.outletId,
    before: beforeData,
    after: {
      operating_hours: parsed.data.operatingHours,
      landing_tagline: parsed.data.landingTagline || null,
      banners_count: cleanBanners.length,
      has_news_banner: Boolean(parsed.data.landingNewsBannerUrl),
      landing_news_title: parsed.data.landingNewsTitle,
      partnership_url: parsed.data.partnershipUrl || null,
      reservation_url: parsed.data.reservationUrl || null,
      feedback_url: parsed.data.feedbackUrl || null,
    },
    reason: `Owner memperbarui banner & link landing page outlet '${String(beforeData.name)}'`,
    prev_hash: "",
    hash: "",
  });

  revalidateOutletCatalogCache(parsed.data.outletId);
  revalidatePath("/dashboard/cabang");
  revalidatePath("/dashboard/landing-page");
  revalidatePath("/dashboard/pengaturan");
  revalidatePath("/m", "layout");

  return {
    ok: true,
    message: `Banner iklan & link landing page '${String(beforeData.name)}' berhasil disimpan.`,
  };
}

export async function switchActiveOutletAction(outletId: string): Promise<ActionResult> {
  await requireStaffRole(["owner", "cashier", "warehouse", "kitchen", "waiter"]);
  const admin = createSupabaseAdminClient();

  const { data: out } = await admin
    .from("outlets")
    .select("id, name")
    .eq("id", outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!out) {
    return { ok: false, message: "Outlet tidak ditemukan atau sudah nonaktif." };
  }

  const cookieStore = await cookies();
  cookieStore.set("fnb1621_active_outlet", outletId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");

  return { ok: true, message: `Masuk ke outlet: ${out.name}` };
}

export async function leaveActiveOutletAction(): Promise<ActionResult> {
  await requireStaffRole(["owner"]);
  const cookieStore = await cookies();
  cookieStore.delete("fnb1621_active_outlet");
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: "Kembali ke Dashboard Pemilik (Semua Outlet).",
  };
}

export async function resetOutletTransactionsAction(
  targetOutletId?: string
): Promise<ActionResult> {
  const staff = await requireStaffRole(["owner"]);
  const admin = createSupabaseAdminClient();
  const outletId = targetOutletId || staff.outletId;

  const { data: orders } = await admin
    .from("orders")
    .select("id")
    .eq("outlet_id", outletId);

  const orderIds = (orders ?? []).map((o) => String(o.id));

  if (orderIds.length > 0) {
    await admin.from("refunds").delete().in("order_id", orderIds);
    await admin.from("payments").delete().in("order_id", orderIds);
    await admin.from("order_items").delete().in("order_id", orderIds);
    await admin.from("orders").delete().eq("outlet_id", outletId);
  }

  await admin.from("accounting_journals").delete().eq("outlet_id", outletId);
  await admin.from("stock_movements").delete().eq("outlet_id", outletId);

  revalidatePath("/", "layout");

  return {
    ok: true,
    message:
      "Data transaksi outlet berhasil di-reset ke Rp 0. Siap untuk input transaksi baru.",
  };
}
