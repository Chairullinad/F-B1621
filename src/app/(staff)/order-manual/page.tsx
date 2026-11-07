import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireStaffRole } from "@/server/auth";

export default async function OrderManualPage() {
  const staff = await requireStaffRole(["owner", "cashier"]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Order Manual (Kasir) — {staff.fullName}</CardTitle>
        <CardDescription>
          Input pesanan Dine-in atau Takeaway secara langsung di kasir dan
          terima pembayaran tunai (langsung berstatus PAID).
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
