import { ProductManager } from "@/components/dashboard/product-manager";
import {
  listCategoriesForOwner,
  listProductsForOwner,
} from "@/server/master-data";

export default async function ProdukPage() {
  const [products, categories] = await Promise.all([
    listProductsForOwner(),
    listCategoriesForOwner(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master Produk &amp; Harga</h1>
        <p className="text-sm text-zinc-600">
          Kelola daftar menu, harga integer Rupiah, dan saklar cepat{" "}
          <strong>Habis / Tersedia</strong>. Perubahan harga dan status langsung
          tercatat di Jejak Audit.
        </p>
      </div>

      <ProductManager initialProducts={products} categories={categories} />
    </div>
  );
}
