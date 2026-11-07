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
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireStaffRole } from "@/server/auth";
import { getTransactionsDashboardData } from "@/server/manual-order-and-transactions";

export const dynamic = "force-dynamic";

const OWNER_CORE_MODULES = [
  {
    href: "/dashboard/keuangan",
    badge: "5 Tab Akuntansi",
    badgeColor: "bg-emerald-100 text-emerald-800",
    title: "📑 Laporan Keuangan & Akuntansi",
    desc: "Jurnal Umum otomatis (POS, HPP, PO, Opname, Waste), Laba Rugi, Neraca, Arus Kas, dan Rekap Pajak.",
  },
  {
    href: "/dashboard/inventory",
    badge: "Auto-Deduct BOM",
    badgeColor: "bg-blue-100 text-blue-800",
    title: "📦 Master Bahan Baku & Resep (BOM)",
    desc: "Kelola stok bahan baku, alert stok minimum, kalkulator HPP otomatis per porsi, dan riwayat mutasi stok.",
  },
  {
    href: "/dashboard/opname",
    badge: "Blind Count Mode",
    badgeColor: "bg-amber-100 text-amber-800",
    title: "📝 Stock Opname & Approval",
    desc: "Staf input stok fisik tanpa melihat stok sistem, hitung varians otomatis, dan approval Owner ber-jurnal.",
  },
  {
    href: "/dashboard/waste",
    badge: "Loss Tracking",
    badgeColor: "bg-rose-100 text-rose-800",
    title: "🗑️ Waste & Spoilage Tracking",
    desc: "Pencatatan bahan rusak, expired, atau tumpah beserta auto-jurnal Beban Waste & pengurangan stok.",
  },
  {
    href: "/dashboard/supplier",
    badge: "Hutang Usaha",
    badgeColor: "bg-purple-100 text-purple-800",
    title: "🏭 Supplier & Purchase Order (PO)",
    desc: "Master supplier, purchase order bahan baku, penerimaan PO otomatis tambah stok, dan pelunasan hutang.",
  },
  {
    href: "/dashboard/transfer-stok",
    badge: "Gudang • Dapur • Bar",
    badgeColor: "bg-indigo-100 text-indigo-800",
    title: "🔄 Transfer / Mutasi Stok Antar Lokasi",
    desc: "Mutasi bahan baku antara Gudang Utama, Dapur, dan Bar dengan verifikasi In-Transit.",
  },
];

const MASTER_AND_CONTROL_MODULES = [
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
    desc: "Kelola akun Kasir, Staff Gudang, Dapur, Pelayan, dan Owner.",
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
  const admin = createSupabaseAdminClient();

  // Ambil data peringatan stok dan approval pending secara real-time
  const [ingRes, opnameRes, trfRes] = await Promise.all([
    admin
      .from("ingredients")
      .select("id, name, unit, current_stock, min_stock")
      .eq("outlet_id", staff.outletId)
      .is("deleted_at", null),
    admin
      .from("stock_opnames")
      .select("id")
      .eq("outlet_id", staff.outletId)
      .eq("status", "waiting_approval"),
    admin
      .from("stock_transfers")
      .select("id")
      .eq("outlet_id", staff.outletId)
      .eq("status", "pending"),
  ]);

  const allIngredients = ingRes.data ?? [];
  const lowStockItems = allIngredients.filter(
    (i) => Number(i.current_stock) <= Number(i.min_stock)
  );
  const pendingOpnameCount = (opnameRes.data ?? []).length;
  const pendingTransferCount = (trfRes.data ?? []).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <Card className="border-slate-800 bg-slate-900 text-white">
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-blue-600 px-2.5 py-0.5 text-xs font-bold text-white">
                f&b1621
              </span>
              <span className="text-xs text-slate-400">
                POS • Inventory • Akuntansi F&B
              </span>
            </div>
            <CardTitle className="mt-1 text-xl font-bold text-white">
              Dashboard Owner — {staff.fullName}
            </CardTitle>
            <CardDescription className="text-slate-300">
              Ringkasan operasional hari ini ({summary.periodLabel}) dan pusat
              kendali restoran terintegrasi.
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/kasir">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-slate-700 bg-slate-800 text-white hover:bg-slate-700"
              >
                Buka Layar Kasir
              </Button>
            </Link>
            <Link href="/dashboard/keuangan">
              <Button
                type="button"
                size="sm"
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Laporan Keuangan 5 Tab
              </Button>
            </Link>
          </div>
        </CardHeader>
      </Card>

      {/* Alert Banner: Stok Menipis */}
      {lowStockItems.length > 0 && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-200 text-lg">
              ⚠️
            </span>
            <div>
              <p className="text-sm font-bold text-amber-900">
                Peringatan Stok: {lowStockItems.length} Bahan Baku di Bawah Stok
                Minimum!
              </p>
              <p className="text-xs text-amber-800">
                {lowStockItems
                  .slice(0, 3)
                  .map(
                    (i) =>
                      `${i.name} (Sisa ${Number(i.current_stock)} ${i.unit})`
                  )
                  .join(", ")}
                {lowStockItems.length > 3
                  ? ` dan ${lowStockItems.length - 3} bahan lainnya`
                  : ""}
                . Segera buat Purchase Order (PO).
              </p>
            </div>
          </div>
          <Link href="/dashboard/inventory">
            <Button
              type="button"
              size="sm"
              className="bg-amber-700 text-white hover:bg-amber-800"
            >
              Kelola Stok Bahan →
            </Button>
          </Link>
        </div>
      )}

      {/* Alert Banner: Menunggu Approval Owner */}
      {(pendingOpnameCount > 0 || pendingTransferCount > 0) && (
        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-blue-300 bg-blue-50 p-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-200 text-lg">
              ⏳
            </span>
            <div>
              <p className="text-sm font-bold text-blue-900">
                Ada Dokumen Menunggu Persetujuan Owner
              </p>
              <p className="text-xs text-blue-800">
                {pendingOpnameCount > 0
                  ? `${pendingOpnameCount} Stock Opname Blind Count`
                  : ""}
                {pendingOpnameCount > 0 && pendingTransferCount > 0 ? " & " : ""}
                {pendingTransferCount > 0
                  ? `${pendingTransferCount} Transfer Stok Internal`
                  : ""}{" "}
                memerlukan tinjauan Anda untuk memperbarui jurnal akuntansi.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            {pendingOpnameCount > 0 && (
              <Link href="/dashboard/opname">
                <Button
                  type="button"
                  size="sm"
                  className="bg-blue-600 text-white hover:bg-blue-700"
                >
                  Approve Opname
                </Button>
              </Link>
            )}
            {pendingTransferCount > 0 && (
              <Link href="/dashboard/transfer-stok">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="border-blue-400 text-blue-900 hover:bg-blue-100"
                >
                  Approve Transfer
                </Button>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Ringkasan Penjualan & Keuangan Harian */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase">
              Penjualan Kotor Hari Ini
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-slate-900">
              {formatRupiah(summary.grossSales)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            {summary.paidOrdersCount} transaksi lunas (Tunai:{" "}
            {formatRupiah(summary.cashGrossSales)} • QRIS:{" "}
            {formatRupiah(summary.qrisGrossSales)})
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase">
              Diskon &amp; Promo Hari Ini
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-amber-700">
              {formatRupiah(summary.totalDiscount)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            Tercatat di Jejak Audit kasir
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-semibold text-slate-500 uppercase">
              Total Refund &amp; Pembatalan
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-rose-600">
              - {formatRupiah(summary.totalRefund)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-slate-500">
            {summary.cancelledOrdersCount} order dibatalkan (stok resep otomatis
            pulih)
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-2 border-emerald-500 bg-emerald-50/50 shadow-sm">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs font-bold tracking-wider text-emerald-900 uppercase">
              Penjualan Bersih Hari Ini
            </CardDescription>
            <CardTitle className="text-2xl font-extrabold text-emerald-800">
              {formatRupiah(summary.netSales)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs font-medium text-emerald-900">
            Penjualan Kotor dikurangi Refund
          </CardContent>
        </Card>
      </div>

      {/* Bagian 1: Modul Utama Inventory & Akuntansi f&b1621 */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              📊 Modul Inventory, Resep &amp; Akuntansi (f&amp;b1621)
            </h3>
            <p className="text-xs text-slate-500">
              Fitur lengkap terintegrasi otomatis dengan operasional kasir &amp;
              dapur
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {OWNER_CORE_MODULES.map((mod) => (
            <Link key={mod.href} href={mod.href} className="group block">
              <Card className="h-full rounded-2xl border-slate-200 transition-all hover:border-blue-500 hover:shadow-md">
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base font-bold text-slate-900 group-hover:text-blue-600">
                      {mod.title}
                    </CardTitle>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-2xs font-bold ${mod.badgeColor}`}
                    >
                      {mod.badge}
                    </span>
                  </div>
                  <CardDescription className="pt-1.5 text-xs text-slate-600">
                    {mod.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {/* Bagian 2: Master Data & Kontrol Restoran */}
      <div>
        <div className="mb-3">
          <h3 className="text-base font-bold text-slate-900">
            ⚙️ Master Data &amp; Kontrol Keamanan Restoran
          </h3>
          <p className="text-xs text-slate-500">
            Manajemen produk, meja &amp; cetak QR massal, staf, pengaturan pajak
            &amp; jejak audit
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {MASTER_AND_CONTROL_MODULES.map((mod) => (
            <Link key={mod.href} href={mod.href} className="group block">
              <Card className="h-full rounded-2xl border-slate-200 transition-all hover:border-slate-400 hover:shadow-xs">
                <CardHeader className="p-4">
                  <CardTitle className="text-sm font-bold text-slate-800 group-hover:text-blue-600">
                    {mod.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    {mod.desc}
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
