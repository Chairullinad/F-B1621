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
import { getKitchenTicketPrintDetail } from "@/server/kitchen-waiter";

export const dynamic = "force-dynamic";

export default async function DapurStrukOrderPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const receipt = await getKitchenTicketPrintDetail(orderId);

  if (!receipt) {
    return (
      <main className="mx-auto max-w-md px-4 py-12">
        <Card>
          <CardHeader>
            <CardTitle>Tiket Kitchen Tidak Ditemukan</CardTitle>
            <CardDescription>
              Order dengan ID <code className="font-mono">{orderId}</code> tidak
              ditemukan atau bukan milik outlet Anda.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/dapur">
              <Button type="button" variant="outline" className="min-h-11">
                ← Kembali ke Layar Kitchen
              </Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-100 dark:bg-slate-950 print:min-h-0 print:bg-white">
      <ReceiptPrintView
        receipt={receipt}
        kitchenOnly
        backHref="/dapur"
        backLabel="Kembali ke Layar Kitchen"
      />
    </main>
  );
}
