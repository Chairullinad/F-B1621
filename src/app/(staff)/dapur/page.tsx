import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffRole } from "@/server/auth";

export default async function DapurPage() {
  const staff = await requireStaffRole(["owner", "kitchen"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Dapur — {staff.fullName}</CardTitle>
        <CardDescription>
          Menampilkan order berstatus PAID secara real-time, urut waktu bayar,
          tanpa menampilkan harga atau data pembayaran.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
