import { TableQrManager } from "@/components/dashboard/table-qr-manager";
import {
  getOutletAndNotificationSettings,
  listTablesForOwner,
} from "@/server/master-data";

export const dynamic = "force-dynamic";

export default async function MejaPage() {
  const [tables, { outlet }] = await Promise.all([
    listTablesForOwner(),
    getOutletAndNotificationSettings(),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[20px] font-bold text-slate-800 dark:text-slate-100">
          Meja &amp; QR Code Pelanggan — {outlet.name}
        </h1>
        <p className="text-[13px] text-slate-500">
          Kelola daftar meja aktif, buka simulasi scan pelanggan di tab baru, atau cetak QR Code meja.
        </p>
      </div>

      <TableQrManager initialTables={tables} outletName={outlet.name} />
    </div>
  );
}
