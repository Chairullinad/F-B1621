import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function StrukOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  return (
    <main className="mx-auto max-w-sm px-4 py-6">
      <Card>
        <CardHeader>
          <CardTitle>Struk Pembayaran</CardTitle>
          <CardDescription>
            ID Order: <code className="font-mono text-xs">{orderId}</code>.
            Layout cetak 58mm/80mm.
          </CardDescription>
        </CardHeader>
      </Card>
    </main>
  );
}

