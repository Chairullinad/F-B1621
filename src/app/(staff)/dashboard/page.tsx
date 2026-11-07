import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const DASHBOARD_MENUS = [
  {
    href: "/dashboard/kategori",
    title: "Kategori Menu",
    desc: "Kelola kategori dan urutan tampil menu.",
  },
  {
    href: "/dashboard/produk",
    title: "Produk & Harga",
    desc: "Kelola produk, harga Rupiah, dan saklar cepat Habis/Tersedia.",
  },
  {
    href: "/dashboard/meja",
    title: "Meja & QR (100 Meja)",
    desc: "Kelola 100 meja, ganti token QR, dan cetak QR massal.",
  },
  {
    href: "/dashboard/staf",
    title: "Staf & Role Pengguna",
    desc: "Tambah staf baru, atur role (Owner, Kasir, Dapur, Pelayan), dan nonaktifkan akun.",
  },
  {
    href: "/dashboard/transaksi",
    title: "Riwayat Transaksi",
    desc: "Lihat transaksi harian, penjualan kotor, refund, dan penjualan bersih.",
  },
  {
    href: "/dashboard/audit",
    title: "Jejak Audit (Append-Only)",
    desc: "Pantau seluruh perubahan data, verifikasi hash rantai audit, dan ekspor CSV.",
  },
  {
    href: "/dashboard/pengaturan",
    title: "Pengaturan Outlet, QRIS & Pajak",
    desc: "Atur profil outlet, QRIS toko, pajak, service charge, batas diskon kasir, dan email Owner.",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Owner</h1>
        <p className="text-sm text-zinc-600">
          Pusat pengelolaan master data, staf, transaksi, pengaturan QRIS/pajak,
          dan jejak audit.
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {DASHBOARD_MENUS.map((item) => (
          <Card key={item.href} className="flex flex-col justify-between">
            <CardHeader>
              <CardTitle className="text-base">{item.title}</CardTitle>
              <CardDescription>{item.desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" className="w-full">
                <Link href={item.href}>Buka {item.title}</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
