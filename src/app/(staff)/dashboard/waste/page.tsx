import { WasteManager } from "@/components/dashboard/waste-manager";
import { getWastePageData } from "@/server/inventory";

export default async function WastePage() {
  const data = await getWastePageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          🗑️ Waste &amp; Spoilage Tracking
        </h1>
        <p className="text-sm text-slate-600">
          Catat bahan baku rusak, busuk, expired, atau tumpah. Setiap pencatatan
          otomatis memotong stok dan menjurnal Beban Waste pada Laporan Keuangan.
        </p>
      </div>

      <WasteManager initialData={data} />
    </div>
  );
}

