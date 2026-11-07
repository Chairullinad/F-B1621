import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function KasirPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Kasir</CardTitle>
        <CardDescription>
          Daftar order masuk real-time (PENDING), revisi order, diskon dengan
          alasan wajib, pembayaran tunai, serta pembatalan/refund.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
