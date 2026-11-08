import { WasteManager } from "@/components/dashboard/waste-manager";
import { getWastePageData } from "@/server/inventory";

export const dynamic = "force-dynamic";

export default async function WastePage() {
  const data = await getWastePageData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-slate-800 dark:text-slate-100">
          Barang Rusak (Waste &amp; Spoilage)
        </h1>
        <p className="text-[13px] text-slate-500">
          Catat bahan baku rusak, kedaluwarsa, atau tumpah yang otomatis memotong stok dan menjurnal Beban Waste.
        </p>
      </div>

      <WasteManager initialData={data} />
    </div>
  );
}
