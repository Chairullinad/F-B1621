import { CategoryManager } from "@/components/dashboard/category-manager";
import { listCategoriesForOwner } from "@/server/master-data";

export default async function KategoriPage() {
  const categories = await listCategoriesForOwner();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master Kategori</h1>
        <p className="text-sm text-zinc-600">
          Kelola nama kategori dan urutan tampil pada layar pelanggan dan kasir.
          Setiap perubahan dicatat otomatis di Jejak Audit.
        </p>
      </div>

      <CategoryManager initialCategories={categories} />
    </div>
  );
}
