import { ProductManager } from "@/components/dashboard/product-manager";
import { loadOutletAddonCatalog } from "@/server/addon-helpers";
import { requireStaffRole } from "@/server/auth";
import {
  listCategoriesForOwner,
  listProductsForOwner,
} from "@/server/master-data";

export const dynamic = "force-dynamic";

export default async function ProdukPage() {
  const owner = await requireStaffRole(["owner"], "menu_kedai");
  const [products, categories, addonCatalog] = await Promise.all([
    listProductsForOwner(),
    listCategoriesForOwner(),
    loadOutletAddonCatalog(owner.outletId, { includeInactiveGroups: true }),
  ]);

  return (
    <ProductManager
      initialProducts={products}
      categories={categories}
      initialAddonCatalog={addonCatalog}
    />
  );
}
