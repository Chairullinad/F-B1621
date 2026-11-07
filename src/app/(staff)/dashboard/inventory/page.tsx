import { InventoryManager } from "@/components/dashboard/inventory-manager";
import { getInventoryPageData } from "@/server/inventory";

export default async function InventoryPage() {
  const data = await getInventoryPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          📦 Inventory Management &amp; Resep (BOM)
        </h1>
        <p className="text-sm text-slate-600">
          Kelola stok bahan baku, batas minimum restock, dan komposisi resep
          menu yang otomatis memotong stok serta menjurnal HPP saat order
          dibayar.
        </p>
      </div>

      <InventoryManager initialData={data} />
    </div>
  );
}

