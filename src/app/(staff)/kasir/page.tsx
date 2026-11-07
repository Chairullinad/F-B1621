import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffRole } from "@/server/auth";

export default async function KasirPage() {
  const staff = await requireStaffRole(["owner", "cashier"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Kasir — {staff.fullName}</CardTitle>
        <CardDescription>
          Daftar order masuk real-time (PENDING), notifikasi konfirmasi QRIS
          berdasarkan nomor meja &amp; nominal, revisi order, diskon dengan
          alasan wajib, pembayaran tunai, serta pembatalan/refund.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
