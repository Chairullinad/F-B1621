import { OpnameManager } from "@/components/dashboard/opname-manager";
import { getStockOpnamePageData } from "@/server/inventory";

export const dynamic = "force-dynamic";

export default async function StockOpnamePage() {
  const data = await getStockOpnamePageData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-slate-800 dark:text-slate-100">
          Stock Opname &amp; Persetujuan Owner
        </h1>
        <p className="text-[13px] text-slate-500">
          Mode perhitungan fisik buta (Blind Count) tanpa membocorkan angka stok sistem, dilengkapi kalkulasi selisih Rupiah.
        </p>
      </div>

      <OpnameManager initialData={data} />
    </div>
  );
}
