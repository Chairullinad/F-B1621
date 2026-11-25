/**
 * src/lib/addons.ts
 * Logika terpusat validasi add-on / varian menu, perhitungan harga satuan integer Rupiah,
 * pemetaan add-on per produk, dan penyusunan catatan snapshot untuk Kasir, KDS, & Struk.
 */

import { assertIntegerRupiah, formatRupiah } from "./money.ts";
import type {
  AddonSelectionType,
  OrderItemAddonSnapshot,
  ProductAddonAssignmentRow,
  ProductAddonGroupRow,
  ProductAddonOptionRow,
} from "./types/database.ts";

export interface ProductAddonOptionView {
  id: string;
  groupId: string;
  name: string;
  priceDelta: number;
  isAvailable: boolean;
  sortOrder: number;
}

export interface ProductAddonGroupWithOptions {
  id: string;
  name: string;
  selectionType: AddonSelectionType;
  isRequired: boolean;
  maxSelect: number | null;
  sortOrder: number;
  isActive: boolean;
  options: ProductAddonOptionView[];
}

export interface ResolvedAddonSelectionResult {
  ok: true;
  selectedAddons: OrderItemAddonSnapshot[];
  totalAddonPrice: number;
  canonicalKey: string;
}

export interface RejectedAddonSelectionResult {
  ok: false;
  message: string;
}

export type ValidateAddonSelectionResult =
  | ResolvedAddonSelectionResult
  | RejectedAddonSelectionResult;

/**
 * Menghitung harga satuan item = harga dasar menu + jumlah price_delta add-on terpilih
 * dalam integer Rupiah.
 */
export function calculateUnitPriceWithAddons(
  basePrice: number,
  addons: ReadonlyArray<{ priceDelta: number }>
): number {
  assertIntegerRupiah(basePrice, "Harga dasar menu");
  let total = basePrice;
  for (const addon of addons) {
    assertIntegerRupiah(addon.priceDelta, "Harga tambahan add-on");
    total += addon.priceDelta;
  }
  return total;
}

/**
 * Mengelompokkan grup add-on + opsi aktif per `product_id` berdasarkan assignment.
 */
export function mapProductAddonsByProductId(params: {
  groups: ReadonlyArray<ProductAddonGroupRow>;
  options: ReadonlyArray<ProductAddonOptionRow>;
  assignments: ReadonlyArray<ProductAddonAssignmentRow>;
  includeInactiveGroups?: boolean;
}): Record<string, ProductAddonGroupWithOptions[]> {
  const optionsByGroup = new Map<string, ProductAddonOptionView[]>();
  for (const opt of params.options) {
    if (opt.deleted_at !== null) continue;
    const list = optionsByGroup.get(opt.group_id) ?? [];
    list.push({
      id: String(opt.id),
      groupId: String(opt.group_id),
      name: String(opt.name),
      priceDelta: Number(opt.price_delta),
      isAvailable: Boolean(opt.is_available),
      sortOrder: Number(opt.sort_order ?? 0),
    });
    optionsByGroup.set(opt.group_id, list);
  }

  for (const list of optionsByGroup.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }

  const groupMap = new Map<string, ProductAddonGroupWithOptions>();
  for (const grp of params.groups) {
    if (grp.deleted_at !== null) continue;
    if (!params.includeInactiveGroups && !grp.is_active) continue;
    const grpOptions = optionsByGroup.get(grp.id) ?? [];
    groupMap.set(String(grp.id), {
      id: String(grp.id),
      name: String(grp.name),
      selectionType: grp.selection_type === "multiple" ? "multiple" : "single",
      isRequired: Boolean(grp.is_required),
      maxSelect:
        grp.max_select !== null && grp.max_select !== undefined
          ? Number(grp.max_select)
          : null,
      sortOrder: Number(grp.sort_order ?? 0),
      isActive: Boolean(grp.is_active),
      options: grpOptions,
    });
  }

  const assignedByProduct = new Map<string, ProductAddonGroupWithOptions[]>();
  const sortedAssignments = [...params.assignments].sort(
    (a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0)
  );

  for (const asg of sortedAssignments) {
    const grp = groupMap.get(asg.addon_group_id);
    if (!grp) continue;
    if (!params.includeInactiveGroups && !grp.options.some((o) => o.isAvailable)) {
      continue;
    }
    const list = assignedByProduct.get(asg.product_id) ?? [];
    if (!list.some((g) => g.id === grp.id)) {
      list.push(grp);
    }
    assignedByProduct.set(asg.product_id, list);
  }

  const result: Record<string, ProductAddonGroupWithOptions[]> = {};
  for (const [productId, list] of assignedByProduct.entries()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    result[productId] = list;
  }
  return result;
}

/**
 * Mengonversi list grup + opsi menjadi tampilan terurut (untuk UI Admin Pengaturan Add-On).
 */
export function buildAddonGroupViewList(params: {
  groups: ReadonlyArray<ProductAddonGroupRow>;
  options: ReadonlyArray<ProductAddonOptionRow>;
}): ProductAddonGroupWithOptions[] {
  const optionsByGroup = new Map<string, ProductAddonOptionView[]>();
  for (const opt of params.options) {
    if (opt.deleted_at !== null) continue;
    const list = optionsByGroup.get(opt.group_id) ?? [];
    list.push({
      id: String(opt.id),
      groupId: String(opt.group_id),
      name: String(opt.name),
      priceDelta: Number(opt.price_delta),
      isAvailable: Boolean(opt.is_available),
      sortOrder: Number(opt.sort_order ?? 0),
    });
    optionsByGroup.set(opt.group_id, list);
  }

  return params.groups
    .filter((g) => g.deleted_at === null)
    .map((grp) => {
      const opts = (optionsByGroup.get(grp.id) ?? []).sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)
      );
      return {
        id: String(grp.id),
        name: String(grp.name),
        selectionType: (grp.selection_type === "multiple" ? "multiple" : "single") as AddonSelectionType,
        isRequired: Boolean(grp.is_required),
        maxSelect:
          grp.max_select !== null && grp.max_select !== undefined
            ? Number(grp.max_select)
            : null,
        sortOrder: Number(grp.sort_order ?? 0),
        isActive: Boolean(grp.is_active),
        options: opts,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

/**
 * Memvalidasi pilihan add-on pelanggan/kasir terhadap daftar grup add-on menu tersebut
 * dan menghitung total priceDelta secara deterministik.
 */
export function validateAndResolveSelectedAddons(params: {
  assignedGroups: ReadonlyArray<ProductAddonGroupWithOptions>;
  selectedOptionIds: ReadonlyArray<string>;
}): ValidateAddonSelectionResult {
  const uniqueSelectedIds = Array.from(new Set(params.selectedOptionIds));
  const optionLookup = new Map<
    string,
    { group: ProductAddonGroupWithOptions; option: ProductAddonOptionView }
  >();

  for (const group of params.assignedGroups) {
    if (!group.isActive) continue;
    for (const option of group.options) {
      optionLookup.set(option.id, { group, option });
    }
  }

  const selectedByGroup = new Map<string, ProductAddonOptionView[]>();
  for (const optId of uniqueSelectedIds) {
    const found = optionLookup.get(optId);
    if (!found) {
      return {
        ok: false,
        message: "Pilihan add-on tidak valid untuk menu ini.",
      };
    }
    if (!found.option.isAvailable) {
      return {
        ok: false,
        message: `Opsi add-on "${found.option.name}" sedang habis.`,
      };
    }
    const list = selectedByGroup.get(found.group.id) ?? [];
    list.push(found.option);
    selectedByGroup.set(found.group.id, list);
  }

  const selectedAddons: OrderItemAddonSnapshot[] = [];
  let totalAddonPrice = 0;

  for (const group of params.assignedGroups) {
    if (!group.isActive) continue;
    const availableOptions = group.options.filter((o) => o.isAvailable);
    const chosen = selectedByGroup.get(group.id) ?? [];

    if (group.isRequired && availableOptions.length > 0 && chosen.length === 0) {
      return {
        ok: false,
        message: `Silakan pilih minimal 1 opsi untuk "${group.name}".`,
      };
    }

    if (group.selectionType === "single" && chosen.length > 1) {
      return {
        ok: false,
        message: `Hanya boleh memilih 1 opsi pada "${group.name}".`,
      };
    }

    if (
      group.selectionType === "multiple" &&
      group.maxSelect !== null &&
      chosen.length > group.maxSelect
    ) {
      return {
        ok: false,
        message: `Maksimal memilih ${group.maxSelect} opsi untuk "${group.name}".`,
      };
    }

    for (const opt of chosen) {
      assertIntegerRupiah(opt.priceDelta, `Harga add-on "${opt.name}"`);
      totalAddonPrice += opt.priceDelta;
      selectedAddons.push({
        groupId: group.id,
        groupName: group.name,
        optionId: opt.id,
        optionName: opt.name,
        priceDelta: opt.priceDelta,
      });
    }
  }

  const canonicalKey = uniqueSelectedIds.sort().join(",");
  return {
    ok: true,
    selectedAddons,
    totalAddonPrice,
    canonicalKey,
  };
}

/**
 * Merangkai add-on terpilih & catatan dapur pelanggan menjadi string catatan bersih
 * untuk `order_items.note` (agar langsung terbaca di Kasir, KDS, Layar Antar, & Struk).
 */
export function composeOrderItemNote(
  selectedAddons: ReadonlyArray<Pick<OrderItemAddonSnapshot, "groupName" | "optionName" | "priceDelta">>,
  customNote?: string | null
): string | null {
  const parts: string[] = [];

  if (selectedAddons.length > 0) {
    const grouped = new Map<string, string[]>();
    for (const addon of selectedAddons) {
      const label =
        addon.priceDelta > 0
          ? `${addon.optionName} (+${formatRupiah(addon.priceDelta)})`
          : addon.optionName;
      const list = grouped.get(addon.groupName) ?? [];
      list.push(label);
      grouped.set(addon.groupName, list);
    }
    const addonSummary = Array.from(grouped.entries())
      .map(([gName, opts]) => `${gName}: ${opts.join(", ")}`)
      .join(" • ");
    parts.push(addonSummary);
  }

  const cleanNote = customNote?.trim() ?? "";
  if (cleanNote.length > 0) {
    parts.push(`Catatan: ${cleanNote}`);
  }

  return parts.length > 0 ? parts.join(" | ") : null;
}
