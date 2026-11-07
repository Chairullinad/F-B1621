"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole, type ActionResult } from "@/server/auth";

export interface OutletView {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  description: string | null;
  logoUrl: string;
  themeColor: string;
  isActive: boolean;
  orderExpiryMinutes: number;
  taxEnabled: boolean;
  taxPercent: number | null;
  serviceEnabled: boolean;
  servicePercent: number | null;
  createdAt: string;
}

const createOutletSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Nama cabang minimal 2 karakter.")
    .max(100, "Nama cabang maksimal 100 karakter."),
  address: z.string().trim().max(250).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  description: z.string().trim().max(250).optional().default("Kafe & Resto Modern"),
  logoUrl: z.string().trim().default("/logo-1621.png"),
  themeColor: z.string().trim().default("#3B7097"),
});

const updateOutletSchema = z.object({
  id: z.string().uuid("ID cabang tidak valid."),
  name: z.string().trim().min(2, "Nama cabang minimal 2 karakter.").max(100),
  address: z.string().trim().max(250).optional().default(""),
  phone: z.string().trim().max(30).optional().default(""),
  description: z.string().trim().max(250).optional().default(""),
  logoUrl: z.string().trim().default("/logo-1621.png"),
  themeColor: z.string().trim().default("#3B7097"),
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
  activeOutletId: string;
}> {
  const staff = await requireStaffRole(["owner", "cashier", "warehouse", "kitchen", "waiter"]);
  const admin = createSupabaseAdminClient();

  const { data: rawOutlets } = await admin
    .from("outlets")
    .select("*")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const outlets: OutletView[] = (rawOutlets ?? []).map((o) => ({
    id: String(o.id),
    name: String(o.name),
    address: (o.address as string | null) ?? null,
    phone: (o.phone as string | null) ?? null,
    description: (o.description as string | null) ?? "Kafe & Resto 1621F&B",
    logoUrl: (o.logo_url as string | null) || "/logo-1621.png",
    themeColor: (o.theme_color as string | null) || "#3B7097",
    isActive: Boolean(o.is_active ?? true),
    orderExpiryMinutes: Number(o.order_expiry_minutes ?? 15),
    taxEnabled: Boolean(o.tax_enabled),
    taxPercent: o.tax_percent !== null ? Number(o.tax_percent) : null,
    serviceEnabled: Boolean(o.service_enabled),
    servicePercent: o.service_percent !== null ? Number(o.service_percent) : null,
    createdAt: String(o.created_at),
  }));

  const cookieStore = await cookies();
  const cookieActiveId = cookieStore.get("fnb1621_active_outlet")?.value;
  const activeOutletId =
    cookieActiveId && outlets.some((o) => o.id === cookieActiveId)
      ? cookieActiveId
      : staff.outletId;

  return { outlets, activeOutletId };
}

export async function createOutletAction(
  rawInput: z.infer<typeof createOutletSchema>
): Promise<ActionResult & { outletId?: string }> {
  const staff = await requireStaffRole(["owner"]);
  const parsed = createOutletSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: parsed.error.issues[0]?.message ?? "Input tidak valid." };
  }

  const { ip, device } = await getRequestMeta();
  const admin = createSupabaseAdminClient();

  const { data: newOutlet, error: insErr } = await admin
    .from("outlets")
    .insert({
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description,
      logo_url: parsed.data.logoUrl || "/logo-1621.png",
      theme_color: parsed.data.themeColor || "#3B7097",
      is_active: true,
      order_expiry_minutes: 15,
      tax_enabled: false,
      tax_percent: null,
      service_enabled: false,
      service_percent: null,
      price_includes_tax: false,
      qris_enabled: false,
    })
    .select("id, name")
    .single();

  if (insErr || !newOutlet) {
    return { ok: false, message: `Gagal membuat cabang baru: ${insErr?.message}` };
  }

  const newOutletId = String(newOutlet.id);

  // Buat 10 Meja Awal Otomatis untuk Cabang Baru
  const defaultTables = Array.from({ length: 10 }, (_, i) => ({
    outlet_id: newOutletId,
    table_no: i + 1,
    name: `Meja ${i + 1}`,
    qr_token: crypto.randomBytes(24).toString("hex"),
    is_active: true,
  }));
  await admin.from("tables").insert(defaultTables);

  // Catat ke Audit Log
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
      theme_color: parsed.data.themeColor,
      logo_url: parsed.data.logoUrl,
    },
    reason: `Owner menambahkan cabang baru '${parsed.data.name}'`,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/dashboard/cabang");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pengaturan");

  return {
    ok: true,
    message: `Cabang '${parsed.data.name}' berhasil dibuat dengan 10 meja siap pakai.`,
    outletId: newOutletId,
  };
}

export async function updateOutletCustomizationAction(
  rawInput: z.infer<typeof updateOutletSchema>
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

  const { error: updErr } = await admin
    .from("outlets")
    .update({
      name: parsed.data.name,
      address: parsed.data.address || null,
      phone: parsed.data.phone || null,
      description: parsed.data.description,
      logo_url: parsed.data.logoUrl,
      theme_color: parsed.data.themeColor,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (updErr) {
    return { ok: false, message: `Gagal memperbarui cabang: ${updErr.message}` };
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
    after: parsed.data,
    reason: `Owner memperbarui kustomisasi tampilan & identitas cabang '${parsed.data.name}'`,
    prev_hash: "",
    hash: "",
  });

  revalidatePath("/dashboard/cabang");
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/pengaturan");

  return { ok: true, message: `Pengaturan cabang '${parsed.data.name}' berhasil disimpan.` };
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
    return { ok: false, message: "Cabang tidak ditemukan atau sudah nonaktif." };
  }

  const cookieStore = await cookies();
  cookieStore.set("fnb1621_active_outlet", outletId, {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60, // 30 hari
  });

  revalidatePath("/", "layout");

  return { ok: true, message: `Berhasil beralih ke cabang: ${out.name}` };
}

