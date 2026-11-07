import { MenuStockManager } from "@/components/dashboard/menu-stock-manager";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/server/auth";
import {
  listCategoriesForOwner,
  listProductsForOwner,
} from "@/server/master-data";

export const dynamic = "force-dynamic";

export default async function StokMenuPage() {
  const staff = await requireStaffRole(["owner", "cashier", "warehouse"]);
  const admin = createSupabaseAdminClient();

  const [products, categories, outletRes] = await Promise.all([
    listProductsForOwner(),
    listCategoriesForOwner(),
    admin.from("outlets").select("name").eq("id", staff.outletId).maybeSingle(),
  ]);

  const outletName = outletRes.data?.name ?? "1621F&B Pusat";

  return (
    <MenuStockManager
      initialProducts={products}
      categories={categories}
      outletName={outletName}
    />
  );
}
