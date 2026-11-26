"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole, type ActionResult } from "@/server/auth";
import { revalidateOutletCatalogCache } from "@/server/outlet-catalog-cache";

const addonOptionInputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Nama pilihan add-on wajib diisi.")
    .max(80, "Nama pilihan maksimal 80 karakter."),
  priceDelta: z
    .number()
    .int("Tambahan harga add-on wajib bilangan bulat Rupiah.")
    .min(0, "Tambahan harga tidak boleh negatif.")
    .max(10_000_000, "Tambahan harga melebihi batas wajar."),
  isAvailable: z.boolean().default(true),
});

const saveAddonGroupSchema = z
  .object({
    id: z.string().uuid().optional(),
    name: z
      .string()
      .trim()
      .min(1, "Nama grup add-on wajib diisi.")
      .max(80, "Nama grup maksimal 80 karakter."),
    selectionType: z.enum(["single", "multiple"]),
    isRequired: z.boolean().default(false),
    maxSelect: z.number().int().min(1).max(30).nullable().optional(),
    isActive: z.boolean().default(true),
    options: z
      .array(addonOptionInputSchema)
      .min(1, "Tambahkan minimal 1 pilihan opsi add-on.")
      .max(40, "Maksimal 40 opsi per grup add-on."),
  })
  .refine(
    (v) => v.selectionType === "multiple" || !v.maxSelect || v.maxSelect === 1,
    { message: "Tipe Pilih 1 otomatis maksimal 1 pilihan.", path: ["maxSelect"] }
  );

async function applyOwnerAddonAudit(reason: string) {
  const owner = await requireStaffRole(["owner"], "menu_kedai");
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

function revalidateMenuAndOrderPaths(outletId?: string | null) {
  revalidateOutletCatalogCache(outletId);
  revalidatePath("/dashboard/produk");
  revalidatePath("/order-manual");
  revalidatePath("/m", "layout");
}

/**
 * Menyimpan (buat baru / perbarui) grup add-on beserta seluruh daftar pilihannya.
 */
export async function saveAddonGroupAction(
  rawInput: z.input<typeof saveAddonGroupSchema>
): Promise<ActionResult & { groupId?: string }> {
  const parsed = saveAddonGroupSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      message: parsed.error.issues[0]?.message ?? "Data add-on tidak valid.",
    };
  }

  const data = parsed.data;
  const { owner, admin } = await applyOwnerAddonAudit(
    data.id
      ? `Perbarui grup add-on: ${data.name}`
      : `Tambah grup add-on baru: ${data.name}`
  );

  const normalizedMaxSelect =
    data.selectionType === "multiple" ? (data.maxSelect ?? null) : null;

  let groupId = data.id;
  if (groupId) {
    const { error: updErr } = await admin
      .from("product_addon_groups")
      .update({
        name: data.name,
        selection_type: data.selectionType,
        is_required: data.isRequired,
        max_select: normalizedMaxSelect,
        is_active: data.isActive,
        updated_at: new Date().toISOString(),
      })
      .eq("id", groupId)
      .eq("outlet_id", owner.outletId)
      .is("deleted_at", null);

    if (updErr) {
      return {
        ok: false,
        message: `Gagal memperbarui grup add-on: ${updErr.message}`,
      };
    }
  } else {
    const { data: created, error: insErr } = await admin
      .from("product_addon_groups")
      .insert({
        outlet_id: owner.outletId,
        name: data.name,
        selection_type: data.selectionType,
        is_required: data.isRequired,
        max_select: normalizedMaxSelect,
        is_active: data.isActive,
        sort_order: 0,
      })
      .select("id")
      .single();

    if (insErr || !created) {
      return {
        ok: false,
        message: `Gagal membuat grup add-on: ${insErr?.message ?? "Unknown error"}`,
      };
    }
    groupId = String(created.id);
  }

  // Sinkronkan opsi dalam grup ini
  const { data: existingOptions } = await admin
    .from("product_addon_options")
    .select("id")
    .eq("group_id", groupId)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null);

  const existingIds = new Set(
    (existingOptions ?? []).map((o) => String(o.id))
  );
  const keptIds = new Set<string>();

  for (let i = 0; i < data.options.length; i++) {
    const opt = data.options[i];
    if (!opt) continue;

    if (opt.id && existingIds.has(opt.id)) {
      keptIds.add(opt.id);
      const { error: optUpdErr } = await admin
        .from("product_addon_options")
        .update({
          name: opt.name,
          price_delta: opt.priceDelta,
          is_available: opt.isAvailable,
          sort_order: i + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", opt.id)
        .eq("outlet_id", owner.outletId);

      if (optUpdErr) {
        return {
          ok: false,
          message: `Gagal memperbarui opsi "${opt.name}": ${optUpdErr.message}`,
        };
      }
    } else {
      const { error: optInsErr } = await admin
        .from("product_addon_options")
        .insert({
          group_id: groupId,
          outlet_id: owner.outletId,
          name: opt.name,
          price_delta: opt.priceDelta,
          is_available: opt.isAvailable,
          sort_order: i + 1,
        });

      if (optInsErr) {
        return {
          ok: false,
          message: `Gagal menambahkan opsi "${opt.name}": ${optInsErr.message}`,
        };
      }
    }
  }

  const removedIds = Array.from(existingIds).filter((id) => !keptIds.has(id));
  if (removedIds.length > 0) {
    await admin
      .from("product_addon_options")
      .update({ deleted_at: new Date().toISOString(), is_available: false })
      .in("id", removedIds)
      .eq("outlet_id", owner.outletId);
  }

  revalidateMenuAndOrderPaths(owner.outletId);
  return {
    ok: true,
    groupId,
    message: `Add-on "${data.name}" berhasil disimpan.`,
  };
}

/**
 * Menghapus grup add-on (soft delete) dan mencabut keterkaitannya dari seluruh menu.
 */
export async function deleteAddonGroupAction(rawInput: {
  id: string;
}): Promise<ActionResult> {
  const parsedId = z.string().uuid().safeParse(rawInput.id);
  if (!parsedId.success) {
    return { ok: false, message: "ID grup add-on tidak valid." };
  }

  const { owner, admin } = await applyOwnerAddonAudit(
    "Hapus grup add-on menu"
  );

  const nowIso = new Date().toISOString();
  const { error } = await admin
    .from("product_addon_groups")
    .update({ deleted_at: nowIso, is_active: false, updated_at: nowIso })
    .eq("id", parsedId.data)
    .eq("outlet_id", owner.outletId);

  if (error) {
    return {
      ok: false,
      message: `Gagal menghapus grup add-on: ${error.message}`,
    };
  }

  await admin
    .from("product_addon_assignments")
    .delete()
    .eq("addon_group_id", parsedId.data)
    .eq("outlet_id", owner.outletId);

  revalidateMenuAndOrderPaths(owner.outletId);
  return { ok: true, message: "Grup add-on berhasil dihapus." };
}

/**
 * Toggle cepat ketersediaan satu pilihan add-on (misal topping habis).
 */
export async function toggleAddonOptionAvailabilityAction(rawInput: {
  optionId: string;
  isAvailable: boolean;
}): Promise<ActionResult> {
  const schema = z.object({
    optionId: z.string().uuid(),
    isAvailable: z.boolean(),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Data opsi add-on tidak valid." };
  }

  const { owner, admin } = await applyOwnerAddonAudit(
    parsed.data.isAvailable
      ? "Aktifkan opsi add-on"
      : "Tandai opsi add-on habis"
  );

  const { error } = await admin
    .from("product_addon_options")
    .update({
      is_available: parsed.data.isAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.optionId)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null);

  if (error) {
    return { ok: false, message: `Gagal mengubah status opsi: ${error.message}` };
  }

  revalidateMenuAndOrderPaths(owner.outletId);
  return {
    ok: true,
    message: parsed.data.isAvailable
      ? "Opsi add-on tersedia kembali."
      : "Opsi add-on ditandai habis.",
  };
}

/**
 * Mengatur menu mana saja yang memakai 1 grup add-on tertentu
 * (dan otomatis melepaskan menu yang tidak dipilih).
 */
export async function setAddonGroupProductsAction(rawInput: {
  addonGroupId: string;
  productIds: string[];
}): Promise<ActionResult> {
  const schema = z.object({
    addonGroupId: z.string().uuid("ID grup add-on tidak valid."),
    productIds: z.array(z.string().uuid()),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Daftar menu pilihan tidak valid." };
  }

  const { owner, admin } = await applyOwnerAddonAudit(
    "Atur penetapan add-on ke daftar menu"
  );

  const uniqueProductIds = Array.from(new Set(parsed.data.productIds));

  // Verifikasi grup milik outlet
  const { data: grp } = await admin
    .from("product_addon_groups")
    .select("id, name")
    .eq("id", parsed.data.addonGroupId)
    .eq("outlet_id", owner.outletId)
    .is("deleted_at", null)
    .maybeSingle();

  if (!grp) {
    return { ok: false, message: "Grup add-on tidak ditemukan." };
  }

  await admin
    .from("product_addon_assignments")
    .delete()
    .eq("addon_group_id", parsed.data.addonGroupId)
    .eq("outlet_id", owner.outletId);

  if (uniqueProductIds.length > 0) {
    const payload = uniqueProductIds.map((pid, idx) => ({
      outlet_id: owner.outletId,
      product_id: pid,
      addon_group_id: parsed.data.addonGroupId,
      sort_order: idx + 1,
    }));
    const { error: insErr } = await admin
      .from("product_addon_assignments")
      .insert(payload);

    if (insErr) {
      return {
        ok: false,
        message: `Gagal menyimpan daftar menu untuk add-on: ${insErr.message}`,
      };
    }
  }

  revalidateMenuAndOrderPaths(owner.outletId);
  return {
    ok: true,
    message: `Penetapan menu untuk "${String(grp.name)}" (${uniqueProductIds.length} menu) tersimpan.`,
  };
}

/**
 * Mengatur grup add-on mana saja yang aktif pada 1 menu spesifik
 * (dipanggil saat Tambah / Edit Menu di halaman Master Menu).
 */
export async function setProductAddonGroupsAction(rawInput: {
  productId: string;
  addonGroupIds: string[];
}): Promise<ActionResult> {
  const schema = z.object({
    productId: z.string().uuid("ID produk tidak valid."),
    addonGroupIds: z.array(z.string().uuid()),
  });
  const parsed = schema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, message: "Daftar grup add-on tidak valid." };
  }

  const { owner, admin } = await applyOwnerAddonAudit(
    "Atur add-on pada produk menu"
  );

  const uniqueGroupIds = Array.from(new Set(parsed.data.addonGroupIds));

  await admin
    .from("product_addon_assignments")
    .delete()
    .eq("product_id", parsed.data.productId)
    .eq("outlet_id", owner.outletId);

  if (uniqueGroupIds.length > 0) {
    const payload = uniqueGroupIds.map((gid, idx) => ({
      outlet_id: owner.outletId,
      product_id: parsed.data.productId,
      addon_group_id: gid,
      sort_order: idx + 1,
    }));
    const { error: insErr } = await admin
      .from("product_addon_assignments")
      .insert(payload);

    if (insErr) {
      return {
        ok: false,
        message: `Gagal menyimpan add-on menu: ${insErr.message}`,
      };
    }
  }

  revalidateMenuAndOrderPaths(owner.outletId);
  return { ok: true, message: "Add-on menu berhasil diperbarui." };
}
