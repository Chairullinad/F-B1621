import Link from "next/link";
import { ReceiptPrintView } from "@/components/receipt/receipt-print-view";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getOrderReceiptDetail } from "@/server/cashier";

export const dynamic = "force-dynamic";

export default async function StrukOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const receipt = await getOrderReceiptDetail(orderId);

  if (!receipt) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Struk Tidak Ditemukan</CardTitle>
            <CardDescription>
              Order dengan ID <code className="font-mono">{orderId}</code> tidak
              ditemukan atau Anda tidak memiliki akses.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/kasir">
              <Button type="button" variant="outline">
                ← Kembali ke Layar Kasir
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 print:bg-white">
      <ReceiptPrintView receipt={receipt} />
    </main>
  );
}
