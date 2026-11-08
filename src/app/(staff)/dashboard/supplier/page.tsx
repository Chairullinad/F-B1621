import { SupplierPoManager } from "@/components/dashboard/supplier-po-manager";
import { getSupplierPageData } from "@/server/inventory";

export const dynamic = "force-dynamic";

export default async function SupplierPage() {
  const data = await getSupplierPageData();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-slate-800 dark:text-slate-100">
          Supplier &amp; Purchase Order (PO)
        </h1>
        <p className="text-[13px] text-slate-500">
          Kelola mitra supplier, termin pembayaran, saldo Hutang Usaha, dan penerimaan PO bahan baku.
        </p>
      </div>

      <SupplierPoManager initialData={data} />
    </div>
  );
}
