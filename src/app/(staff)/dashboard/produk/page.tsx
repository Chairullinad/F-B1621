import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProdukPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Master Produk</CardTitle>
        <CardDescription>
          Kelola daftar menu, harga integer Rupiah, dan status ketersediaan
          (Habis / Tersedia).
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

