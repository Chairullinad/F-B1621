"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import {
  isSafeActionLinkUrl,
  mapOutletRowToView,
  type LandingBannerItem,
  type OutletView,
} from "@/lib/outlets";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole, type ActionResult } from "@/server/auth";

export type { LandingBannerItem, OutletView };

const createOutletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama usaha/kios minimal 2 karakter.")
    .max(100, "Nama usaha/kios maksimal 100 karakter."),
  address: z.string().trim().max(250).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  description: z.string().trim().max(250).optional().default("Kafe & Resto Modern"),
  receiptFooter: z
    .string()
    .trim()
    .max(300)
    .optional()
    .default("Terima kasih atas kunjungan Anda!"),
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
});

const updateOutletSchema = z.object({
  id: z.string().uuid("ID kios tidak valid."),
  name: z
    .string()
    .trim()
    .min(2, "Nama usaha/kios minimal 2 karakter.")
    .max(100),
  address: z.string().trim().max(250).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  description: z.string().trim().max(250).optional().default(""),
  receiptFooter: z.string().trim().max(300).optional().default(""),
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
  outletId: z.string().uuid("ID kios tidak valid."),
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

export async function listAllOutletsAction(): Promise<{
  outlets: OutletView[];
  activeOutletId: string | null;
}> {
  const staff = await requireStaffRole(["owner", "cashier", "warehouse", "kitchen", "waiter"]);
  const admin = createSupabaseAdminClient();

  const { data: rawOutlets } = await admin
    .from("outlets")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const outlets: OutletView[] = (rawOutlets ?? []).map((o) =>
    mapOutletRowToView(o as Record<string, unknown>)
  );

  if (staff.role !== "owner") {
    return { outlets, activeOutletId: staff.outletId };
  }

  const validSelectedId =
    staff.selectedOutletId && outlets.some((o) => o.id === staff.selectedOutletId)
      ? staff.selectedOutletId
      : null;

  return { outlets, activeOutletId: validSelectedId };
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

  const { data: newOutlet, error: insErr } = await admin
    .from("outlets")
    .insert({
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
    })
    .select("*")
    .single();

  if (insErr || !newOutlet) {
    return { ok: false, message: `Gagal membuat kios baru: ${insErr?.message}` };
  }

  const newOutletId = String(newOutlet.id);

  // Buat 10 Meja Awal Otomatis untuk Kios Baru (aman dan tahan kegagalan)
  try {
    const defaultTables = Array.from({ length: 10 }, (_, i) => ({
      outlet_id: newOutletId,
      table_no: i + 1,
      name: `Meja ${i + 1}`,
      qr_token: crypto.randomBytes(24).toString("hex"),
      is_active: true,
    }));
    await admin.from("tables").insert(defaultTables);
  } catch (tableErr) {
    console.error("Gagal inisialisasi meja kios baru:", tableErr);
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
      },
      reason: `Owner menambahkan kios/usaha baru '${parsed.data.name}'`,
      prev_hash: "",
      hash: "",
    });
  } catch (auditErr) {
    console.error("Gagal mencatat audit log kios baru:", auditErr);
  }

  revalidatePath("/dashboard/cabang");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pengaturan");

  const newOutletView = mapOutletRowToView(newOutlet as Record<string, unknown>);

  return {
    ok: true,
    message: `Usaha '${parsed.data.name}' berhasil dibuat dengan 10 meja siap pakai.`,
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

  const { error: updErr } = await admin
    .from("outlets")
    .update({
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description || null,
      logo_url: parsed.data.logoUrl || "/logo-1621group-stacked.png",
      theme_color: parsed.data.themeColor || "#0284C7",
      receipt_footer: resolvedFooter,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (updErr) {
    return { ok: false, message: `Gagal memperbarui profil kios: ${updErr.message}` };
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
    },
    reason: `Owner memperbarui profil & logo kios '${parsed.data.name}'`,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/dashboard/cabang");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pengaturan");

  return { ok: true, message: `Profil kios '${parsed.data.name}' berhasil disimpan.` };
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
    return { ok: false, message: "Kios tidak ditemukan atau sudah dinonaktifkan." };
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
    reason: `Owner memperbarui banner & link landing page kios '${String(beforeData.name)}'`,
    prev_hash: "",
    hash: "",
  });

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
    return { ok: false, message: "Kios tidak ditemukan atau sudah nonaktif." };
  }

  const cookieStore = await cookies();
  cookieStore.set("fnb1621_active_outlet", outletId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
  });

  revalidatePath("/", "layout");

  return { ok: true, message: `Masuk ke kios: ${out.name}` };
}

export async function leaveActiveOutletAction(): Promise<ActionResult> {
  await requireStaffRole(["owner"]);
  const cookieStore = await cookies();
  cookieStore.delete("fnb1621_active_outlet");
  revalidatePath("/", "layout");

  return {
    ok: true,
    message: "Kembali ke Dashboard Pemilik (Semua Kios).",
  };
}

export async function resetOutletDemoTransactionsAction(
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
      "Data transaksi demo cabang berhasil di-reset ke Rp 0. Siap untuk simulasi input baru.",
  };
}
