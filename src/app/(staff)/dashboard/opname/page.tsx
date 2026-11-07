import { OpnameManager } from "@/components/dashboard/opname-manager";
import { getStockOpnamePageData } from "@/server/inventory";

export default async function StockOpnamePage() {
  const data = await getStockOpnamePageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          🔍 Stock Opname &amp; Approval Owner
        </h1>
        <p className="text-sm text-slate-600">
          Mode perhitungan fisik buta (Blind Count) tanpa membocorkan angka stok
          sistem, dilengkapi kalkulasi selisih Rupiah dan jurnal penyesuaian
          otomatis.
        </p>
      </div>

      <OpnameManager initialData={data} />
    </div>
  );
}

