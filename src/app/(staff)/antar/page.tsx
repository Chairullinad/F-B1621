import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AntarPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Layar Antar (Pelayan)</CardTitle>
        <CardDescription>
          Menampilkan order berstatus READY per meja dan tombol Sudah Diantar
          (SERVED).
        </CardDescription>
      </CardHeader>
    </Card>
  );
}
