import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function OrderManualPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Order Manual (Kasir)</CardTitle>
        <CardDescription>
          Input pesanan Dine-in atau Takeaway secara langsung di kasir dan
          terima pembayaran tunai (langsung berstatus PAID).
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
