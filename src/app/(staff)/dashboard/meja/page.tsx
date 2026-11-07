import { TableQrManager } from "@/components/dashboard/table-qr-manager";
import {
  getOutletAndNotificationSettings,
  listTablesForOwner,
} from "@/server/master-data";

export default async function MejaPage() {
  const [tables, { outlet }] = await Promise.all([
    listTablesForOwner(),
    getOutletAndNotificationSettings(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Master Meja &amp; QR (100 Meja)</h1>
        <p className="text-sm text-zinc-600">
          Kelola 100 meja tetap, cetak QR massal (PDF) atau per meja, dan ganti
          token QR jika diperlukan.
        </p>
      </div>

      <TableQrManager initialTables={tables} outletName={outlet.name} />
    </div>
  );
}
