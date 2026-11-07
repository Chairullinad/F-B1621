import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TransaksiPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Riwayat Transaksi</CardTitle>
        <CardDescription>
          Daftar transaksi dengan filter tanggal, status, kasir, detail refund,
          serta cetak ulang struk.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
