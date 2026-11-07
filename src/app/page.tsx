import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRupiah } from "@/lib/money";
import { getSystemConnectionStatus } from "@/server/system-status";

const ROLE_ROUTES = [
  {
    title: "Login Staf",
    role: "Semua Staf",
    href: "/login",
    description: "Halaman masuk untuk Owner, Kasir, Dapur, dan Pelayan.",
  },
  {
    title: "Layar Kasir",
    role: "Cashier / Owner",
    href: "/kasir",
    description:
      "Daftar order masuk real-time, revisi order PENDING, diskon, dan pembayaran tunai.",
  },
  {
    title: "Order Manual",
    role: "Cashier / Owner",
    href: "/order-manual",
    description:
      "Input pesanan langsung di kasir (Dine-in / Takeaway) dan bayar tunai.",
  },
  {
    title: "Layar Dapur",
    role: "Kitchen / Owner",
    href: "/dapur",
    description:
      "Antrean pesanan berstatus PAID secara real-time dan tombol Siap Diantar.",
  },
  {
    title: "Layar Antar",
    role: "Waiter / Owner",
    href: "/antar",
    description:
      "Daftar pesanan berstatus READY per meja untuk diantar pelayan.",
  },
  {
    title: "Dashboard Owner",
    role: "Owner",
    href: "/dashboard",
    description:
      "Kelola kategori, produk, 100 meja QR, pajak/service charge, transaksi, dan jejak audit.",
  },
];

export default async function HomePage() {
  const connection = await getSystemConnectionStatus();

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge variant="default">Fase 1 MVP</Badge>
            <Badge
              variant={connection.supabaseConfigured ? "success" : "warning"}
            >
              {connection.supabaseConfigured
                ? "Supabase Dev Terkonfigurasi"
                : "Menunggu .env.local"}
            </Badge>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
            POS 1621 F&amp;B Web
          </h1>
          <p className="mt-1 text-sm text-zinc-600">
            1 Outlet &bull; 100 Meja QR &bull; 5 Perangkat Kasir &bull; Contoh
            format uang: <span className="font-semibold">{formatRupiah(25000)}</span>
          </p>
        </div>

        <Button asChild size="lg">
          <Link href="/login">Masuk Staf</Link>
        </Button>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-base">Status Lingkungan Development</CardTitle>
          <CardDescription>{connection.message}</CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ROLE_ROUTES.map((item) => (
          <Card key={item.href} className="flex flex-col justify-between">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-base">{item.title}</CardTitle>
                <Badge variant="secondary">{item.role}</Badge>
              </div>
              <CardDescription className="pt-1">
                {item.description}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={item.href}>Buka {item.title}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

