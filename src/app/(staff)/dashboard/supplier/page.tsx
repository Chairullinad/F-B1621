import { SupplierPoManager } from "@/components/dashboard/supplier-po-manager";
import { getSupplierPageData } from "@/server/inventory";

export default async function SupplierPage() {
  const data = await getSupplierPageData();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          🏭 Supplier &amp; Purchase Order (PO)
        </h1>
        <p className="text-sm text-slate-600">
          Kelola mitra supplier, termin pembayaran, saldo Hutang Usaha, dan
          penerimaan PO bahan baku yang otomatis menambah stok serta menjurnal
          akuntansi.
        </p>
      </div>

      <SupplierPoManager initialData={data} />
    </div>
  );
}

