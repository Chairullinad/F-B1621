"use server";

import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/server/auth";

export interface MenuStockItem {
  id: string;
  name: string;
  categoryId: string;
  categoryName: string;
  isActive: boolean;
  isAvailable: boolean;
  availability: "Stok Tidak Terbatas" | "Stok Terbatas" | "Stok Habis";
  stockCount: number;
}

export interface MenuStockPageData {
  items: MenuStockItem[];
  categories: Array<{ id: string; name: string }>;
  availableOutlets: Array<{ id: string; name: string }>;
  activeOutletId: string;
  activeOutletName: string;
}

export async function getMenuStockPageData(params?: {
  outletId?: string;
}): Promise<MenuStockPageData> {
  const staff = await requireStaffRole(["owner", "cashier", "warehouse", "kitchen", "waiter"]);
  const admin = createSupabaseAdminClient();

  // 1. Ambil daftar semua outlet untuk dropdown
  const { data: rawOutlets } = await admin
    .from("outlets")
    .select("id, name")
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  const availableOutlets = (rawOutlets ?? []).map((o) => ({
    id: String(o.id),
    name: String(o.name),
  }));

  const targetOutletId =
    params?.outletId && availableOutlets.some((o) => o.id === params.outletId)
      ? params.outletId
      : staff.outletId;

  const activeOutletName =
    availableOutlets.find((o) => o.id === targetOutletId)?.name ?? "1621F&B Pusat";

  // 2. Ambil Kategori untuk outlet aktif
  const { data: rawCategories } = await admin
    .from("categories")
    .select("id, name")
    .eq("outlet_id", targetOutletId)
    .is("deleted_at", null)
    .order("sort_order", { ascending: true });

  const categoryMap = new Map<string, string>();
  for (const c of rawCategories ?? []) {
    categoryMap.set(String(c.id), String(c.name));
  }

  // 3. Ambil Produk untuk outlet aktif
  const { data: rawProducts } = await admin
    .from("products")
    .select("id, name, category_id, is_active, is_available")
    .eq("outlet_id", targetOutletId)
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const products = rawProducts ?? [];
  const productIds = products.map((p) => String(p.id));

  // 4. Ambil Resep BOM dan Stok Bahan Baku untuk menghitung porsi riil
  const [recipesRes, ingredientsRes] = productIds.length > 0
    ? await Promise.all([
        admin
          .from("product_recipes")
          .select("product_id, ingredient_id, qty_per_portion")
          .in("product_id", productIds),
        admin
          .from("ingredients")
          .select("id, current_stock")
          .eq("outlet_id", targetOutletId)
          .is("deleted_at", null),
      ])
    : [{ data: [] }, { data: [] }];

  const ingredientStockMap = new Map<string, number>();
  for (const ing of (ingredientsRes.data ?? []) as Array<{ id: string; current_stock: number }>) {
    ingredientStockMap.set(String(ing.id), Number(ing.current_stock ?? 0));
  }

  const recipesByProduct = new Map<
    string,
    Array<{ ingredientId: string; qtyPerPortion: number }>
  >();
  for (const rec of (recipesRes.data ?? []) as Array<{
    product_id: string;
    ingredient_id: string;
    qty_per_portion: number;
  }>) {
    const list = recipesByProduct.get(rec.product_id) ?? [];
    list.push({
      ingredientId: rec.ingredient_id,
      qtyPerPortion: Number(rec.qty_per_portion),
    });
    recipesByProduct.set(rec.product_id, list);
  }

  // 5. Susun List Item Stok Menu
  const items: MenuStockItem[] = products.map((p) => {
    const prodId = String(p.id);
    const catId = String(p.category_id);
    const catName = categoryMap.get(catId) ?? "Makanan";
    const isActive = Boolean(p.is_active);
    const isAvailable = Boolean(p.is_available);

    const recipes = recipesByProduct.get(prodId) ?? [];

    let availability: "Stok Tidak Terbatas" | "Stok Terbatas" | "Stok Habis" =
      "Stok Tidak Terbatas";
    let stockCount = 0;

    if (!isAvailable || !isActive) {
      availability = "Stok Habis";
      stockCount = 0;
    } else if (recipes.length === 0) {
      availability = "Stok Tidak Terbatas";
      stockCount = 0;
    } else {
      // Hitung porsi maksimal yang bisa dibuat berdasarkan bahan baku terkecil
      let maxPortions = Infinity;
      for (const r of recipes) {
        const curStock = ingredientStockMap.get(r.ingredientId) ?? 0;
        const portions = Math.floor(curStock / r.qtyPerPortion);
        if (portions < maxPortions) {
          maxPortions = portions;
        }
      }

      if (maxPortions <= 0) {
        availability = "Stok Habis";
        stockCount = 0;
      } else {
        availability = "Stok Terbatas";
        stockCount = maxPortions;
      }
    }

    return {
      id: prodId,
      name: String(p.name),
      categoryId: catId,
      categoryName: catName,
      isActive,
      isAvailable,
      availability,
      stockCount,
    };
  });

  return {
    items,
    categories: (rawCategories ?? []).map((c) => ({
      id: String(c.id),
      name: String(c.name),
    })),
    availableOutlets,
    activeOutletId: targetOutletId,
    activeOutletName,
  };
}
