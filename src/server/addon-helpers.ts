import "server-only";

import {
  buildAddonGroupViewList,
  calculateUnitPriceWithAddons,
  composeOrderItemNote,
  mapProductAddonsByProductId,
  validateAndResolveSelectedAddons,
  type ProductAddonGroupWithOptions,
} from "@/lib/addons";
import { calculateLineTotal } from "@/lib/money";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  OrderItemAddonSnapshot,
  ProductAddonAssignmentRow,
  ProductAddonGroupRow,
  ProductAddonOptionRow,
} from "@/lib/types/database";

export interface OutletAddonCatalog {
  schemaReady: boolean;
  groups: ProductAddonGroupWithOptions[];
  assignments: ProductAddonAssignmentRow[];
  addonsByProduct: Record<string, ProductAddonGroupWithOptions[]>;
}

function isMissingAddonSchemaError(message?: string | null): boolean {
  if (!message) return false;
  const lower = message.toLowerCase();
  return (
    lower.includes("does not exist") ||
    lower.includes("could not find the table") ||
    lower.includes("schema cache")
  );
}

/**
 * Memuat seluruh grup add-on, opsi, dan mapping ke menu milik outlet.
 * Tetap mengembalikan fallback aman bila migrasi SQL add-on belum diterapkan.
 */
export async function loadOutletAddonCatalog(
  outletId: string,
  options?: { includeInactiveGroups?: boolean }
): Promise<OutletAddonCatalog> {
  const admin = createSupabaseAdminClient();

  const [groupsRes, optionsRes, assignmentsRes] = await Promise.all([
    admin
      .from("product_addon_groups")
      .select("*")
      .eq("outlet_id", outletId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("product_addon_options")
      .select("*")
      .eq("outlet_id", outletId)
      .is("deleted_at", null)
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true }),
    admin
      .from("product_addon_assignments")
      .select("*")
      .eq("outlet_id", outletId)
      .order("sort_order", { ascending: true }),
  ]);

  const firstError =
    groupsRes.error?.message ||
    optionsRes.error?.message ||
    assignmentsRes.error?.message;

  if (firstError && isMissingAddonSchemaError(firstError)) {
    return {
      schemaReady: false,
      groups: [],
      assignments: [],
      addonsByProduct: {},
    };
  }

  const rawGroups = (groupsRes.data ?? []) as ProductAddonGroupRow[];
  const rawOptions = (optionsRes.data ?? []) as ProductAddonOptionRow[];
  const rawAssignments = (assignmentsRes.data ?? []) as ProductAddonAssignmentRow[];

  return {
    schemaReady: !firstError,
    groups: buildAddonGroupViewList({
      groups: rawGroups,
      options: rawOptions,
    }),
    assignments: rawAssignments,
    addonsByProduct: mapProductAddonsByProductId({
      groups: rawGroups,
      options: rawOptions,
      assignments: rawAssignments,
      includeInactiveGroups: options?.includeInactiveGroups,
    }),
  };
}

export interface ServerNormalizedOrderItem {
  productId: string;
  productName: string;
  unitPrice: number;
  qty: number;
  note: string | null;
  addonsSnapshot: OrderItemAddonSnapshot[];
  lineTotal: number;
}

/**
 * Memvalidasi daftar item pesanan + add-on di server dan menghitung harga satuan/lineTotal
 * secara aman berdasarkan snapshot database.
 */
export function resolveServerOrderItemsWithAddons(params: {
  items: ReadonlyArray<{
    productId: string;
    qty: number;
    note?: string | null;
    addonOptionIds?: ReadonlyArray<string> | null;
  }>;
  productMap: ReadonlyMap<
    string,
    { name: string; price: number; isAvailable: boolean }
  >;
  addonsByProduct: Record<string, ProductAddonGroupWithOptions[]>;
}):
  | { ok: true; items: ServerNormalizedOrderItem[] }
  | { ok: false; message: string } {
  const normalized: ServerNormalizedOrderItem[] = [];

  for (const reqItem of params.items) {
    const prod = params.productMap.get(reqItem.productId);
    if (!prod) {
      return {
        ok: false,
        message: "Salah satu menu yang dipilih tidak ditemukan atau sudah tidak aktif.",
      };
    }
    if (!prod.isAvailable) {
      return {
        ok: false,
        message: `Maaf, menu "${prod.name}" baru saja habis. Silakan hapus dari keranjang.`,
      };
    }

    const assignedGroups = params.addonsByProduct[reqItem.productId] ?? [];
    const selectedIds = reqItem.addonOptionIds ?? [];

    const addonValidation = validateAndResolveSelectedAddons({
      assignedGroups,
      selectedOptionIds: selectedIds,
    });

    if (!addonValidation.ok) {
      return {
        ok: false,
        message: `${prod.name}: ${addonValidation.message}`,
      };
    }

    const unitPrice = calculateUnitPriceWithAddons(
      prod.price,
      addonValidation.selectedAddons
    );
    const lineTotal = calculateLineTotal(unitPrice, reqItem.qty);
    const composedNote = composeOrderItemNote(
      addonValidation.selectedAddons,
      reqItem.note
    );

    normalized.push({
      productId: reqItem.productId,
      productName: prod.name,
      unitPrice,
      qty: reqItem.qty,
      note: composedNote,
      addonsSnapshot: addonValidation.selectedAddons,
      lineTotal,
    });
  }

  return { ok: true, items: normalized };
}

/**
 * Menyimpan baris `order_items` beserta `addons_snapshot`, dengan fallback aman
 * bila kolom `addons_snapshot` belum dimigrasi.
 */
export async function insertOrderItemsWithAddonFallback(
  orderId: string,
  items: ReadonlyArray<ServerNormalizedOrderItem>
): Promise<{ error: { message: string } | null }> {
  const admin = createSupabaseAdminClient();
  const payloadWithAddons = items.map((item) => ({
    order_id: orderId,
    product_id: item.productId,
    product_name: item.productName,
    unit_price: item.unitPrice,
    qty: item.qty,
    note: item.note,
    addons_snapshot: item.addonsSnapshot,
    line_total: item.lineTotal,
  }));

  const firstTry = await admin.from("order_items").insert(payloadWithAddons);
  if (!firstTry.error) {
    return { error: null };
  }

  if (
    firstTry.error.message.toLowerCase().includes("addons_snapshot") ||
    firstTry.error.message.toLowerCase().includes("column")
  ) {
    const fallbackPayload = items.map((item) => ({
      order_id: orderId,
      product_id: item.productId,
      product_name: item.productName,
      unit_price: item.unitPrice,
      qty: item.qty,
      note: item.note,
      line_total: item.lineTotal,
    }));
    const retry = await admin.from("order_items").insert(fallbackPayload);
    return { error: retry.error ? { message: retry.error.message } : null };
  }

  return { error: { message: firstTry.error.message } };
}
