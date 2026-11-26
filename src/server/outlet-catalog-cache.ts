import "server-only";

import { revalidateTag, unstable_cache } from "next/cache";
import type { ProductAddonGroupWithOptions } from "@/lib/addons";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CategoryRow, ProductRow } from "@/lib/types/database";
import { loadOutletAddonCatalog } from "@/server/addon-helpers";

export const OUTLET_CATALOG_GLOBAL_TAG = "outlet_catalog";

export function getOutletCatalogTag(outletId: string): string {
  return `outlet_catalog_${outletId}`;
}

export function revalidateOutletCatalogCache(outletId?: string | null): void {
  revalidateTag(OUTLET_CATALOG_GLOBAL_TAG);
  if (outletId) {
    revalidateTag(getOutletCatalogTag(outletId));
  }
}

export interface CachedMenuCatalogData {
  categories: CategoryRow[];
  products: ProductRow[];
  addonsByProduct: Record<string, ProductAddonGroupWithOptions[]>;
}

/**
 * Cache 30 detik untuk katalog kategori, produk lengkap, dan add-on per outlet.
 * Di-invalidate otomatis melalui `revalidateOutletCatalogCache` saat menu/kategori/add-on berubah.
 */
export async function getCachedOutletMenuCatalog(
  outletId: string
): Promise<CachedMenuCatalogData> {
  const loader = unstable_cache(
    async (): Promise<CachedMenuCatalogData> => {
      const admin = createSupabaseAdminClient();
      const [catRes, prodRes, addonCatalog] = await Promise.all([
        admin
          .from("categories")
          .select("*")
          .eq("outlet_id", outletId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true })
          .order("name", { ascending: true }),
        admin
          .from("products")
          .select("*")
          .eq("outlet_id", outletId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name", { ascending: true }),
        loadOutletAddonCatalog(outletId),
      ]);

      return {
        categories: (catRes.data ?? []) as CategoryRow[],
        products: (prodRes.data ?? []) as ProductRow[],
        addonsByProduct: addonCatalog.addonsByProduct,
      };
    },
    ["outlet_full_menu_catalog", outletId],
    {
      revalidate: 30,
      tags: [OUTLET_CATALOG_GLOBAL_TAG, getOutletCatalogTag(outletId)],
    }
  );

  return loader();
}

export interface CachedCashierLiteCatalogData {
  categories: CategoryRow[];
  products: ProductRow[];
}

/**
 * Cache 30 detik katalog kategori & produk ringan (tanpa `image_url` base64 berat)
 * khusus untuk keperluan revisi item di Layar Kasir.
 */
export async function getCachedCashierLiteMenuCatalog(
  outletId: string
): Promise<CachedCashierLiteCatalogData> {
  const loader = unstable_cache(
    async (): Promise<CachedCashierLiteCatalogData> => {
      const admin = createSupabaseAdminClient();
      const [catRes, prodRes] = await Promise.all([
        admin
          .from("categories")
          .select(
            "id, outlet_id, name, sort_order, is_active, created_at, updated_at, deleted_at"
          )
          .eq("outlet_id", outletId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("sort_order", { ascending: true }),
        admin
          .from("products")
          .select(
            "id, outlet_id, category_id, name, price, is_available, is_active, created_at, updated_at, deleted_at"
          )
          .eq("outlet_id", outletId)
          .eq("is_active", true)
          .is("deleted_at", null)
          .order("name", { ascending: true }),
      ]);

      return {
        categories: (catRes.data ?? []) as CategoryRow[],
        products: (prodRes.data ?? []) as ProductRow[],
      };
    },
    ["outlet_cashier_lite_catalog", outletId],
    {
      revalidate: 30,
      tags: [OUTLET_CATALOG_GLOBAL_TAG, getOutletCatalogTag(outletId)],
    }
  );

  return loader();
}

/**
 * Cache 30 detik profil outlet untuk halaman self-order & polling status pelanggan
 * agar 100 meja bersamaan tidak melakukan `outlets.select("*")` terus-menerus.
 */
export async function getCachedCustomerOutletRow(
  outletId: string
): Promise<Record<string, unknown> | null> {
  const loader = unstable_cache(
    async (): Promise<Record<string, unknown> | null> => {
      const admin = createSupabaseAdminClient();
      const { data, error } = await admin
        .from("outlets")
        .select("*")
        .eq("id", outletId)
        .is("deleted_at", null)
        .maybeSingle();

      if (error || !data) return null;
      return data as Record<string, unknown>;
    },
    ["customer_outlet_row", outletId],
    {
      revalidate: 30,
      tags: [OUTLET_CATALOG_GLOBAL_TAG, getOutletCatalogTag(outletId)],
    }
  );

  return loader();
}
