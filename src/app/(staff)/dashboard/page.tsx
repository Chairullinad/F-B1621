import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatRupiah } from "@/lib/money";
import { requireStaffRole } from "@/server/auth";
import { getTransactionsDashboardData } from "@/server/manual-order-and-transactions";

export const dynamic = "force-dynamic";

const OWNER_MODULES = [
  {
    href: "/dashboard/transaksi",
    title: "Riwayat Transaksi & Refund",
    desc: "Penjualan kotor, refund, penjualan bersih, detail order, dan cetak ulang struk.",
  },
  {
    href: "/dashboard/produk",
    title: "Produk & Menu",
    desc: "Kelola daftar menu, harga integer Rupiah, foto, dan status Habis/Tersedia.",
  },
  {
    href: "/dashboard/kategori",
    title: "Kategori Menu",
    desc: "Kelola kategori dan urutan tampil menu di halaman pelanggan & kasir.",
  },
  {
    href: "/dashboard/meja",
    title: "100 Meja & Cetak QR",
    desc: "Kelola 100 meja, cetak QR massal siap tempel, dan regenerasi token QR.",
  },
  {
    href: "/dashboard/staf",
    title: "Akun Staf & Role",
    desc: "Kelola akun Kasir, Dapur, Pelayan, dan Owner.",
  },
  {
    href: "/dashboard/pengaturan",
    title: "Pengaturan Outlet, Pajak & QRIS",
    desc: "Atur profil outlet, payload QRIS toko, saklar pajak & service charge, batas diskon kasir, dan notifikasi email.",
  },
  {
    href: "/dashboard/audit",
    title: "Jejak Audit (Append-Only)",
    desc: "Pantau seluruh perubahan data, verifikasi rantai hash SHA-256, dan ekspor CSV.",
  },
];

export default async function OwnerDashboardPage() {
  const staff = await requireStaffRole(["owner"]);
  const todayData = await getTransactionsDashboardData({ period: "today" });
  const { summary } = todayData;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle>Dashboard Owner — {staff.fullName}</CardTitle>
            <CardDescription>
              Ringkasan penjualan hari ini ({summary.periodLabel}) dan pusat
              kendali master data &amp; audit trail.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/kasir">
              <Button type="button" variant="outline" size="sm">
                Buka Layar Kasir
              </Button>
            </Link>
            <Link href="/order-manual">
              <Button type="button" size="sm">
                + Buat Order Manual
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Ringkasan Keuangan Harian Real-time */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Penjualan Kotor Hari Ini</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-zinc-900">
              {formatRupiah(summary.grossSales)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            {summary.paidOrdersCount} transaksi lunas (Tunai:{" "}
            {formatRupiah(summary.cashGrossSales)} • QRIS:{" "}
            {formatRupiah(summary.qrisGrossSales)})
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Diskon Hari Ini</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-amber-700">
              {formatRupiah(summary.totalDiscount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            Akumulasi diskon pada order hari ini
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Refund Hari Ini</CardDescription>
            <CardTitle className="text-2xl font-extrabold text-red-600">
              - {formatRupiah(summary.totalRefund)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-zinc-500">
            {summary.cancelledOrdersCount} order dibatalkan hari ini
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-600 bg-emerald-50/40">
          <CardHeader className="pb-2">
            <CardDescription className="font-semibold text-emerald-900">
              Penjualan Bersih Hari Ini
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-emerald-800">
              {formatRupiah(summary.netSales)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-medium text-emerald-900">
            Penjualan Kotor dikurangi Total Refund
          </CardContent>
        </Card>
      </div>

      {/* Pintasan Modul Dashboard Owner */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OWNER_MODULES.map((mod) => (
          <Link key={mod.href} href={mod.href} className="block">
            <Card className="h-full transition-colors hover:border-zinc-900">
              <CardHeader>
                <CardTitle className="text-base">{mod.title}</CardTitle>
                <CardDescription>{mod.desc}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
