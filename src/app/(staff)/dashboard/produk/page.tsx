import { ProductManager } from "@/components/dashboard/product-manager";
import {
  listCategoriesForOwner,
  listProductsForOwner,
} from "@/server/master-data";

export const dynamic = "force-dynamic";

export default async function ProdukPage() {
  const [products, categories] = await Promise.all([
    listProductsForOwner(),
    listCategoriesForOwner(),
  ]);

  return <ProductManager initialProducts={products} categories={categories} />;
}
