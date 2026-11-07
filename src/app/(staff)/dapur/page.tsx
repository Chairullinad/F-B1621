import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function DapurPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Dapur</CardTitle>
        <CardDescription>
          Menampilkan order berstatus PAID secara real-time, urut waktu bayar,
          tanpa menampilkan harga atau data pembayaran.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
