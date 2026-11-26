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

const ALLOWED_BACK_TARGETS = new Map<
  string,
  { href: string; label: string }
>([
  ["/kasir", { href: "/kasir", label: "Kembali ke Layar Kasir" }],
  [
    "/kasir?tab=kitchen",
    { href: "/kasir?tab=kitchen", label: "Kembali ke Layar Kitchen" },
  ],
  [
    "/kasir?tab=antar",
    { href: "/kasir?tab=antar", label: "Kembali ke Layar Antar" },
  ],
  [
    "/kasir?tab=shift",
    { href: "/kasir?tab=shift", label: "Kembali ke Tutupan Shift" },
  ],
  [
    "/dashboard/transaksi",
    { href: "/dashboard/transaksi", label: "Kembali ke Riwayat Transaksi" },
  ],
]);

export default async function StrukOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ backTo?: string }>;
}) {
  const [{ orderId }, sp, receipt] = await Promise.all([
    params,
    searchParams,
    params.then((p) => getOrderReceiptDetail(p.orderId)),
  ]);

  const backTarget = ALLOWED_BACK_TARGETS.get(sp.backTo ?? "") ?? {
    href: "/kasir",
    label: "Kembali ke Kasir",
  };

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
            <Link href={backTarget.href}>
              <Button type="button" variant="outline">
                ← {backTarget.label}
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
        backHref={backTarget.href}
        backLabel={backTarget.label}
      />
    </main>
  );
}
